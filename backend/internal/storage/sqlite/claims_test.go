package sqlite

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
	"github.com/sanditzz/minigames-storefront/backend/internal/storage"
)

// These tests exist because of an asymmetry in the layer above: app.issueClaim
// deliberately does NOT fail a submission when a claim cannot be written (the
// score is already committed and the prize stock already spent — see its
// comment). It logs and returns nil instead. That is the right call for a
// player mid-round, but it means a broken INSERT here would be invisible to
// both the service tests, which use an in-memory fake, and the browser suite,
// which would see a perfectly normal winning round with no code on it.
//
// So the SQL is exercised directly, against a real database file.

func newTestStore(t *testing.T) *Store {
	t.Helper()
	store, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })
	if err := store.Migrate(context.Background()); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return store
}

var issuedAt = time.Date(2026, 7, 25, 12, 0, 0, 0, time.UTC)

func sampleClaim() domain.Claim {
	return domain.Claim{
		ID: "claim-1", Code: "ABCD2345", ScoreID: "score-1",
		AwardID: "award-1", AwardName: "Free Coffee",
		IssuedAt: issuedAt, ExpiresAt: issuedAt.Add(168 * time.Hour),
	}
}

func TestClaimsRoundTrip(t *testing.T) {
	ctx := context.Background()
	claims := newTestStore(t).Claims()
	want := sampleClaim()

	if _, err := claims.Create(ctx, want); err != nil {
		t.Fatalf("create: %v", err)
	}

	got, err := claims.GetByCode(ctx, want.Code)
	if err != nil {
		t.Fatalf("get by code: %v", err)
	}
	if got.ID != want.ID || got.ScoreID != want.ScoreID || got.AwardID != want.AwardID {
		t.Fatalf("identity fields did not round-trip: %+v", got)
	}
	// The snapshot is the field this whole design turns on.
	if got.AwardName != "Free Coffee" {
		t.Fatalf("award name = %q, want %q", got.AwardName, "Free Coffee")
	}
	if !got.IssuedAt.Equal(want.IssuedAt) || !got.ExpiresAt.Equal(want.ExpiresAt) {
		t.Fatalf("timestamps did not round-trip: issued=%v expires=%v", got.IssuedAt, got.ExpiresAt)
	}
	if got.RedeemedAt != nil {
		t.Fatalf("redeemed_at = %v, want nil on a fresh claim", got.RedeemedAt)
	}

	byScore, err := claims.GetByScore(ctx, want.ScoreID)
	if err != nil || byScore.Code != want.Code {
		t.Fatalf("get by score = (%+v, %v)", byScore, err)
	}
}

// A zero ExpiresAt means "never expires" and must survive as NULL, not as a
// zero-valued timestamp string that would parse back as the year 1.
func TestClaimWithNoExpiryRoundTripsAsNull(t *testing.T) {
	ctx := context.Background()
	claims := newTestStore(t).Claims()

	c := sampleClaim()
	c.ExpiresAt = time.Time{}
	if _, err := claims.Create(ctx, c); err != nil {
		t.Fatalf("create: %v", err)
	}

	got, err := claims.GetByCode(ctx, c.Code)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if !got.ExpiresAt.IsZero() {
		t.Fatalf("expires_at = %v, want the zero time", got.ExpiresAt)
	}
}

// The UNIQUE constraint is the real defence against a code collision, and the
// caller's retry loop only works if the violation arrives as ErrConflict rather
// than an opaque driver error.
func TestDuplicateCodeIsAConflict(t *testing.T) {
	ctx := context.Background()
	claims := newTestStore(t).Claims()

	first := sampleClaim()
	if _, err := claims.Create(ctx, first); err != nil {
		t.Fatalf("create: %v", err)
	}

	second := sampleClaim()
	second.ID = "claim-2"
	second.ScoreID = "score-2"
	_, err := claims.Create(ctx, second)
	if !errors.Is(err, storage.ErrConflict) {
		t.Fatalf("err = %v, want storage.ErrConflict", err)
	}
}

// Two admins at the same counter, one prize.
func TestRedeemIsAtomicAndHappensOnce(t *testing.T) {
	ctx := context.Background()
	claims := newTestStore(t).Claims()
	if _, err := claims.Create(ctx, sampleClaim()); err != nil {
		t.Fatalf("create: %v", err)
	}
	at := issuedAt.Add(time.Hour)

	got, err := claims.Redeem(ctx, "ABCD2345", at)
	if err != nil {
		t.Fatalf("first redeem: %v", err)
	}
	if got.RedeemedAt == nil || !got.RedeemedAt.Equal(at) {
		t.Fatalf("redeemed_at = %v, want %v", got.RedeemedAt, at)
	}

	_, err = claims.Redeem(ctx, "ABCD2345", at.Add(time.Minute))
	if !errors.Is(err, storage.ErrConflict) {
		t.Fatalf("second redeem err = %v, want storage.ErrConflict", err)
	}
	// And the original timestamp must be untouched by the failed attempt.
	after, err := claims.GetByCode(ctx, "ABCD2345")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if !after.RedeemedAt.Equal(at) {
		t.Fatalf("redeemed_at moved to %v, want it pinned at %v", after.RedeemedAt, at)
	}
}

func TestMissingClaimsAreNotFound(t *testing.T) {
	ctx := context.Background()
	claims := newTestStore(t).Claims()

	if _, err := claims.GetByCode(ctx, "ZZZZ9999"); !errors.Is(err, storage.ErrNotFound) {
		t.Fatalf("get by code err = %v, want ErrNotFound", err)
	}
	if _, err := claims.GetByScore(ctx, "nope"); !errors.Is(err, storage.ErrNotFound) {
		t.Fatalf("get by score err = %v, want ErrNotFound", err)
	}
	// Redeeming a code that does not exist is a mistyped code, not a conflict —
	// the admin needs to be told those apart.
	if _, err := claims.Redeem(ctx, "ZZZZ9999", issuedAt); !errors.Is(err, storage.ErrNotFound) {
		t.Fatalf("redeem err = %v, want ErrNotFound", err)
	}
}

func TestListReturnsNewestFirst(t *testing.T) {
	ctx := context.Background()
	claims := newTestStore(t).Claims()

	for i, code := range []string{"AAAA1111", "BBBB2222", "CCCC3333"} {
		c := sampleClaim()
		c.ID = code
		c.Code = code
		c.ScoreID = code
		c.IssuedAt = issuedAt.Add(time.Duration(i) * time.Hour)
		if _, err := claims.Create(ctx, c); err != nil {
			t.Fatalf("create %s: %v", code, err)
		}
	}

	got, err := claims.List(ctx)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	want := []string{"CCCC3333", "BBBB2222", "AAAA1111"}
	if len(got) != len(want) {
		t.Fatalf("got %d claims, want %d", len(got), len(want))
	}
	for i, code := range want {
		if got[i].Code != code {
			t.Fatalf("[%d] = %q, want %q", i, got[i].Code, code)
		}
	}
}

// Migrate runs on every boot, so it has to be safe to run against a database
// that already has the claims table — and must not disturb its rows.
func TestMigrateIsIdempotent(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	if _, err := store.Claims().Create(ctx, sampleClaim()); err != nil {
		t.Fatalf("create: %v", err)
	}

	if err := store.Migrate(ctx); err != nil {
		t.Fatalf("second migrate: %v", err)
	}

	if _, err := store.Claims().GetByCode(ctx, "ABCD2345"); err != nil {
		t.Fatalf("claim did not survive a re-migration: %v", err)
	}
}
