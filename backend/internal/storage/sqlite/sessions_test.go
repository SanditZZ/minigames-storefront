package sqlite

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
	"github.com/sanditzz/minigames-storefront/backend/internal/storage"
)

// The sessions table had no test of its own until a migration proved it needed
// one. Adding domain.Session.Challenge meant a new column, a new INSERT
// parameter and a new column in two SELECTs — and the whole Go suite stayed
// green while every single POST /sessions returned a 500, because the service
// tests run against an in-memory fake and nothing exercised this SQL.
//
// The browser suite caught it, which is the wrong place: it is the slowest gate
// step and it failed 24 tests for one missing ALTER. So the round trip is pinned
// here, against a real database file, the same argument claims_test.go makes.

func sampleSession() domain.Session {
	return domain.Session{
		Token:     "b2a1c0de-0000-4000-8000-000000000001",
		GameSlug:  "precision-stop",
		IssuedAt:  issuedAt,
		ExpiresAt: issuedAt.Add(2 * time.Minute),
		Challenge: `{"phaseMs":371,"periodMs":1400}`,
	}
}

// The test that would have caught the missing migration: a plain create-then-read
// fails outright if the schema and the INSERT disagree about the columns.
func TestSessionRoundTripsThroughStorage(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()
	want := sampleSession()

	if err := store.Sessions().Create(ctx, want); err != nil {
		t.Fatalf("create session: %v", err)
	}
	got, err := store.Sessions().Get(ctx, want.Token)
	if err != nil {
		t.Fatalf("get session: %v", err)
	}
	if got.GameSlug != want.GameSlug {
		t.Fatalf("game slug = %q, want %q", got.GameSlug, want.GameSlug)
	}
	if !got.IssuedAt.Equal(want.IssuedAt) || !got.ExpiresAt.Equal(want.ExpiresAt) {
		t.Fatalf("times did not survive: issued %v expires %v", got.IssuedAt, got.ExpiresAt)
	}
	if got.ConsumedAt != nil {
		t.Fatalf("a fresh session must not be consumed, got %v", got.ConsumedAt)
	}
}

// The challenge has to come back BYTE FOR BYTE. A Scorer replays a round against
// it, so a value mangled in storage is a round scored by different numbers than
// the player played — which would surface as a wrong score, not as an error.
func TestSessionChallengeSurvivesStorageExactly(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()
	want := sampleSession()

	if err := store.Sessions().Create(ctx, want); err != nil {
		t.Fatalf("create session: %v", err)
	}
	got, err := store.Sessions().Get(ctx, want.Token)
	if err != nil {
		t.Fatalf("get session: %v", err)
	}
	if got.Challenge != want.Challenge {
		t.Fatalf("challenge = %q, want %q", got.Challenge, want.Challenge)
	}

	// And it must still be there after the permit is spent: Consume re-reads the
	// row, and submit scores the round from what that read returns.
	consumed, err := store.Sessions().Consume(ctx, want.Token)
	if err != nil {
		t.Fatalf("consume: %v", err)
	}
	if consumed.Challenge != want.Challenge {
		t.Fatalf("challenge after consume = %q, want %q", consumed.Challenge, want.Challenge)
	}
	if consumed.ConsumedAt == nil {
		t.Fatal("consume did not stamp consumed_at")
	}
}

// A client-scored game stores no challenge, and an empty string has to be a
// legal value rather than a NOT NULL violation — every tap-fast session is one.
func TestSessionWithNoChallengeIsLegal(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()
	sess := sampleSession()
	sess.Token = "b2a1c0de-0000-4000-8000-000000000002"
	sess.GameSlug = "tap-fast"
	sess.Challenge = ""

	if err := store.Sessions().Create(ctx, sess); err != nil {
		t.Fatalf("a session with no challenge must be storable: %v", err)
	}
	got, err := store.Sessions().Get(ctx, sess.Token)
	if err != nil {
		t.Fatalf("get session: %v", err)
	}
	if got.Challenge != "" {
		t.Fatalf("challenge = %q, want empty", got.Challenge)
	}
}

// The guarantee the whole single-use design rests on: a second Consume conflicts
// rather than scoring twice.
func TestSessionCannotBeConsumedTwice(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()
	sess := sampleSession()

	if err := store.Sessions().Create(ctx, sess); err != nil {
		t.Fatalf("create session: %v", err)
	}
	if _, err := store.Sessions().Consume(ctx, sess.Token); err != nil {
		t.Fatalf("first consume: %v", err)
	}
	if _, err := store.Sessions().Consume(ctx, sess.Token); !errors.Is(err, storage.ErrConflict) {
		t.Fatalf("second consume error = %v, want ErrConflict", err)
	}
}

func TestSessionMissingTokenIsNotFound(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	if _, err := store.Sessions().Get(ctx, "nope"); !errors.Is(err, storage.ErrNotFound) {
		t.Fatalf("get error = %v, want ErrNotFound", err)
	}
	if _, err := store.Sessions().Consume(ctx, "nope"); !errors.Is(err, storage.ErrNotFound) {
		t.Fatalf("consume error = %v, want ErrNotFound", err)
	}
}
