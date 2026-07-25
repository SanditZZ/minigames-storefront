package sqlite

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
)

// The games table gained target_score after databases already existed in the
// wild, so the interesting path is not the fresh schema — it is an ALTER
// against a table that predates the column. Nothing else exercises it: every
// other test opens an empty file, where the base schema already has it.

func sampleGame() domain.Game {
	return domain.Game{
		Slug: "precision-stop", Name: "Precision Stop",
		Description: "Stop the marker dead centre.",
		ScoreUnit:   "off", Direction: domain.LowerIsBetter,
		DurationMs: 6000, TargetScore: 5, Enabled: true,
	}
}

func TestGameTargetScoreRoundTrips(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	if err := store.Games().Upsert(ctx, sampleGame()); err != nil {
		t.Fatalf("upsert: %v", err)
	}

	got, err := store.Games().Get(ctx, "precision-stop")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.TargetScore != 5 {
		t.Fatalf("TargetScore = %d, want 5 — the reveal meter has no honest scale without it", got.TargetScore)
	}

	// Upsert is what Seed calls on every boot, so an edited benchmark must
	// actually move rather than be silently kept at its first value.
	updated := sampleGame()
	updated.TargetScore = 8
	if err := store.Games().Upsert(ctx, updated); err != nil {
		t.Fatalf("re-upsert: %v", err)
	}
	got, err = store.Games().Get(ctx, "precision-stop")
	if err != nil {
		t.Fatalf("get after re-upsert: %v", err)
	}
	if got.TargetScore != 8 {
		t.Fatalf("TargetScore = %d after re-upsert, want 8", got.TargetScore)
	}
}

func TestMigrateAddsTargetScoreToAPreExistingGamesTable(t *testing.T) {
	ctx := context.Background()
	store, err := Open(filepath.Join(t.TempDir(), "old.db"))
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })

	// The games table exactly as a database written before this column had it,
	// carrying a row that must survive the migration intact.
	if _, err := store.db.ExecContext(ctx, `
		CREATE TABLE games (
			slug TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
			score_unit TEXT NOT NULL, direction TEXT NOT NULL,
			duration_ms INTEGER NOT NULL, enabled INTEGER NOT NULL
		);
		INSERT INTO games VALUES ('tap-fast','Tap Fast','Tap it','taps','higher',5000,1);`); err != nil {
		t.Fatalf("seed old schema: %v", err)
	}

	// Twice: Migrate runs on every boot, so a second pass must be a no-op
	// rather than a duplicate-column error.
	for i := 0; i < 2; i++ {
		if err := store.Migrate(ctx); err != nil {
			t.Fatalf("migrate pass %d: %v", i+1, err)
		}
	}

	got, err := store.Games().Get(ctx, "tap-fast")
	if err != nil {
		t.Fatalf("get after migrate: %v", err)
	}
	if got.Name != "Tap Fast" || got.DurationMs != 5000 {
		t.Fatalf("the pre-existing row was not preserved: %+v", got)
	}
	// 0 is the documented "unset" default. Seed overwrites it on the next boot
	// with the in-code catalog's value; until then the client falls back.
	if got.TargetScore != 0 {
		t.Fatalf("TargetScore = %d on a migrated row, want the 0 default", got.TargetScore)
	}
}
