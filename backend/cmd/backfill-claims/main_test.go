package main

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/sanditzz/minigames-storefront/backend/internal/claim"
	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
	"github.com/sanditzz/minigames-storefront/backend/internal/id"
	"github.com/sanditzz/minigames-storefront/backend/internal/storage/sqlite"
)

// --- The pure half ----------------------------------------------------------

func TestPartitionWinsSetsAsideWinsWhoseAwardIsGone(t *testing.T) {
	awards := map[string]domain.Award{
		"live": {ID: "live", Name: "Free Coffee"},
	}
	wins := []win{
		{ScoreID: "s1", AwardID: "live"},
		{ScoreID: "s2", AwardID: "deleted"},
		{ScoreID: "s3", AwardID: "live"},
	}

	claimable, orphaned := partitionWins(wins, awards)

	if len(claimable) != 2 || claimable[0].ScoreID != "s1" || claimable[1].ScoreID != "s3" {
		t.Fatalf("claimable = %+v, want s1 and s3 in order", claimable)
	}
	// There is no name to snapshot, and award_name is the column that must
	// outlive the award — inventing one would put a lie in it.
	if len(orphaned) != 1 || orphaned[0].ScoreID != "s2" {
		t.Fatalf("orphaned = %+v, want just s2", orphaned)
	}
}

func TestPartitionWinsHandlesNothingToDo(t *testing.T) {
	claimable, orphaned := partitionWins(nil, map[string]domain.Award{})
	if len(claimable) != 0 || len(orphaned) != 0 {
		t.Fatalf("empty input produced %d claimable, %d orphaned", len(claimable), len(orphaned))
	}
}

// --- Against a real database ------------------------------------------------

// seeded builds a throwaway database holding one won round with no claim, and
// returns its path. The award is live, so the win is claimable.
func seeded(t *testing.T, roundAt time.Time) (path, scoreID, awardID string) {
	t.Helper()
	path = filepath.Join(t.TempDir(), "backfill.db")

	store, err := sqlite.Open(path)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer store.Close()
	ctx := context.Background()
	if err := store.Migrate(ctx); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	awardID = id.New()
	if _, err := store.Awards().Create(ctx, domain.Award{
		ID: awardID, Name: "Free Coffee", NameTH: "กาแฟฟรี",
		GameSlug: "tap-fast", MinScore: 30, Stock: domain.Unlimited, Active: true,
	}); err != nil {
		t.Fatalf("seed award: %v", err)
	}

	scoreID = id.New()
	if _, err := store.Scores().Create(ctx, domain.ScoreEntry{
		ID: scoreID, GameSlug: "tap-fast", PlayerName: "Po",
		Value: 42, AwardID: awardID, CreatedAt: roundAt,
	}); err != nil {
		t.Fatalf("seed score: %v", err)
	}
	return path, scoreID, awardID
}

// readBack reopens the database through the REAL store, which is the point of
// every test that calls it: the script writes its timestamps by hand, and the
// only thing that proves the format agrees is the production reader parsing it.
func readBack(t *testing.T, path, scoreID string) (domain.Claim, error) {
	t.Helper()
	store, err := sqlite.Open(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	defer store.Close()
	return store.Claims().GetByScore(context.Background(), scoreID)
}

// The whole repair, end to end: a win with no claim gets one, and the row the
// script hand-wrote is readable by the code that serves it.
func TestBackfillIssuesAClaimTheStoreCanRead(t *testing.T) {
	roundAt := time.Now().UTC().Add(-2 * time.Hour).Truncate(time.Nanosecond)
	path, scoreID, awardID := seeded(t, roundAt)

	if err := run(path, true, "", t.TempDir()); err != nil {
		t.Fatalf("apply: %v", err)
	}

	got, err := readBack(t, path, scoreID)
	if err != nil {
		t.Fatalf("the backfilled claim is not readable through the store: %v", err)
	}
	if got.AwardID != awardID {
		t.Fatalf("award id = %q, want %q", got.AwardID, awardID)
	}
	// The snapshot, both languages — a claim is read by the player in their
	// locale and by the counter in English.
	if got.AwardName != "Free Coffee" || got.AwardNameTH != "กาแฟฟรี" {
		t.Fatalf("snapshot = %q / %q, want the award's names copied", got.AwardName, got.AwardNameTH)
	}
	if !id.LooksLikeClaimCode(got.Code) {
		t.Fatalf("code %q is not in the claim-code format", got.Code)
	}
	// The timestamp is the assertion that catches a format drift: a mismatch
	// parses to the zero time rather than failing loudly.
	if !got.IssuedAt.Equal(roundAt) {
		t.Fatalf("issuedAt = %v, want the ROUND's time %v", got.IssuedAt, roundAt)
	}
	// The window starts when the round ended, exactly as claim.Issue decides for
	// a live submission — the script must not have its own opinion about this.
	wantExpiry := roundAt.Add(claim.TTL(domain.DefaultClaimTTLHours))
	if !got.ExpiresAt.Equal(wantExpiry) {
		t.Fatalf("expiresAt = %v, want %v", got.ExpiresAt, wantExpiry)
	}
	if got.RedeemedAt != nil {
		t.Fatal("a backfilled claim must not look collected")
	}
	if status := claim.StatusAt(got, time.Now()); status != domain.ClaimIssued {
		t.Fatalf("status = %q, want a recent round's claim to be redeemable", status)
	}
}

// A round older than the claim window reconstructs to an expired claim. That is
// the honest answer — the window really did close — and it is still worth
// writing, because a row the counter can look up beats no row at all.
func TestBackfillReconstructsAnExpiredClaimForAnOldRound(t *testing.T) {
	roundAt := time.Now().UTC().Add(-time.Duration(domain.DefaultClaimTTLHours+24) * time.Hour)
	path, scoreID, _ := seeded(t, roundAt)

	if err := run(path, true, "", t.TempDir()); err != nil {
		t.Fatalf("apply: %v", err)
	}

	got, err := readBack(t, path, scoreID)
	if err != nil {
		t.Fatalf("read back: %v", err)
	}
	if status := claim.StatusAt(got, time.Now()); status != domain.ClaimExpired {
		t.Fatalf("status = %q, want expired — the round predates the window", status)
	}
}

// The script rule that matters most in practice: running it twice must not
// issue a second claim for the same round.
func TestBackfillIsIdempotent(t *testing.T) {
	path, scoreID, _ := seeded(t, time.Now().UTC().Add(-time.Hour))

	if err := run(path, true, "", t.TempDir()); err != nil {
		t.Fatalf("first apply: %v", err)
	}
	first, err := readBack(t, path, scoreID)
	if err != nil {
		t.Fatalf("read back: %v", err)
	}

	if err := run(path, true, "", t.TempDir()); err != nil {
		t.Fatalf("second apply: %v", err)
	}
	second, err := readBack(t, path, scoreID)
	if err != nil {
		t.Fatalf("read back after re-run: %v", err)
	}

	// GetByScore returns one row; a duplicate would have been inserted with a
	// different code, so an unchanged code is the evidence nothing was added.
	if second.Code != first.Code {
		t.Fatalf("a re-run replaced the claim: code %q became %q", first.Code, second.Code)
	}
	if second.ID != first.ID {
		t.Fatalf("a re-run minted a second claim: id %q became %q", first.ID, second.ID)
	}
}

// A dry run is the default and must write nothing at all.
func TestBackfillDryRunWritesNothing(t *testing.T) {
	path, scoreID, _ := seeded(t, time.Now().UTC().Add(-time.Hour))

	if err := run(path, false, "", t.TempDir()); err != nil {
		t.Fatalf("dry run: %v", err)
	}

	if _, err := readBack(t, path, scoreID); err == nil {
		t.Fatal("the dry run issued a claim; -apply is what commits")
	}
}

func TestRevertRemovesExactlyWhatItIssued(t *testing.T) {
	path, scoreID, _ := seeded(t, time.Now().UTC().Add(-time.Hour))
	backupDir := t.TempDir()

	if err := run(path, true, "", backupDir); err != nil {
		t.Fatalf("apply: %v", err)
	}
	if _, err := readBack(t, path, scoreID); err != nil {
		t.Fatalf("claim was not issued: %v", err)
	}

	if err := run(path, false, onlyBackup(t, backupDir), ""); err != nil {
		t.Fatalf("revert: %v", err)
	}
	if _, err := readBack(t, path, scoreID); err == nil {
		t.Fatal("revert left the claim in place")
	}

	// And the undo is itself re-runnable: a second pass finds nothing and says
	// so rather than failing.
	if err := run(path, false, onlyBackup(t, backupDir), ""); err != nil {
		t.Fatalf("second revert: %v", err)
	}
}

// The rule the revert exists to protect: a prize that has been handed over is a
// record of a transaction, not a script's output, and tidying up must not erase
// it.
func TestRevertRefusesToDeleteARedeemedClaim(t *testing.T) {
	path, scoreID, _ := seeded(t, time.Now().UTC().Add(-time.Hour))
	backupDir := t.TempDir()

	if err := run(path, true, "", backupDir); err != nil {
		t.Fatalf("apply: %v", err)
	}

	issued, err := readBack(t, path, scoreID)
	if err != nil {
		t.Fatalf("read back: %v", err)
	}
	store, err := sqlite.Open(path)
	if err != nil {
		t.Fatalf("open to redeem: %v", err)
	}
	if _, err := store.Claims().Redeem(context.Background(), issued.Code, time.Now().UTC()); err != nil {
		store.Close()
		t.Fatalf("redeem: %v", err)
	}
	store.Close()

	if err := run(path, false, onlyBackup(t, backupDir), ""); err != nil {
		t.Fatalf("revert: %v", err)
	}

	kept, err := readBack(t, path, scoreID)
	if err != nil {
		t.Fatalf("the revert deleted a redeemed claim: %v", err)
	}
	if kept.RedeemedAt == nil {
		t.Fatal("the claim survived but lost its redemption stamp")
	}
}

// onlyBackup returns the single backup file in dir, failing if there is not
// exactly one — a test that reverted the wrong file would be worse than one
// that failed here.
func onlyBackup(t *testing.T, dir string) string {
	t.Helper()
	matches, err := filepath.Glob(filepath.Join(dir, "backfill-claims-*.json"))
	if err != nil {
		t.Fatalf("glob: %v", err)
	}
	if len(matches) != 1 {
		t.Fatalf("found %d backup files in %s, want exactly 1", len(matches), dir)
	}
	return matches[0]
}
