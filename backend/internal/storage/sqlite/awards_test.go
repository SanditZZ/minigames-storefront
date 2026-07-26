package sqlite

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
)

func openAwardStore(t *testing.T) *Store {
	t.Helper()
	store, err := Open(filepath.Join(t.TempDir(), "awards.db"))
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })
	if err := store.Migrate(context.Background()); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return store
}

// The Thai text has to survive the write and both read paths. Get and List use
// separate scanners over the same column list, and nothing but a test can catch
// one of them being updated and the other not — a Scan argument list that does
// not match its SELECT is a runtime error, not a compile one.
func TestAwardThaiTextRoundTripsThroughGetAndList(t *testing.T) {
	ctx := context.Background()
	store := openAwardStore(t)
	now := time.Now().UTC().Truncate(time.Second)

	want := domain.Award{
		ID:            "awardidxyz1",
		Name:          "Free Coffee",
		Description:   "Reach 40 taps to earn a free coffee.",
		NameTH:        "กาแฟฟรี",
		DescriptionTH: "แตะให้ได้ 40 ครั้งเพื่อรับกาแฟฟรี",
		GameSlug:      "tap-fast",
		MinScore:      40,
		Stock:         domain.Unlimited,
		Active:        true,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if _, err := store.Awards().Create(ctx, want); err != nil {
		t.Fatalf("create: %v", err)
	}

	got, err := store.Awards().Get(ctx, want.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.NameTH != want.NameTH || got.DescriptionTH != want.DescriptionTH {
		t.Fatalf("Get lost the Thai text: %q / %q", got.NameTH, got.DescriptionTH)
	}

	list, err := store.Awards().List(ctx)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("list returned %d awards, want 1", len(list))
	}
	if list[0].NameTH != want.NameTH || list[0].DescriptionTH != want.DescriptionTH {
		t.Fatalf("List lost the Thai text: %q / %q", list[0].NameTH, list[0].DescriptionTH)
	}
}

// Editing a prize must be able to REMOVE a translation, not only add one. An
// UPDATE that omitted the columns would silently pin the first Thai name an
// operator ever saved, which is the failure mode of every "only write what
// changed" update statement.
func TestAwardUpdateCanClearTheThaiText(t *testing.T) {
	ctx := context.Background()
	store := openAwardStore(t)
	now := time.Now().UTC().Truncate(time.Second)

	a := domain.Award{
		ID: "awardidxyz2", Name: "Tote", NameTH: "ถุงผ้า", DescriptionTH: "ของรางวัลพิเศษ",
		GameSlug: "tap-fast", MinScore: 60, Stock: 5, Active: true,
		CreatedAt: now, UpdatedAt: now,
	}
	if _, err := store.Awards().Create(ctx, a); err != nil {
		t.Fatalf("create: %v", err)
	}

	a.NameTH = ""
	a.DescriptionTH = ""
	if _, err := store.Awards().Update(ctx, a); err != nil {
		t.Fatalf("update: %v", err)
	}

	got, err := store.Awards().Get(ctx, a.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.NameTH != "" || got.DescriptionTH != "" {
		t.Fatalf("clearing the translation did not persist: %q / %q", got.NameTH, got.DescriptionTH)
	}
}

// A database written before these columns existed must migrate without losing
// its prizes, and must land on "" — which the resolver reads as "not
// translated" and serves the English text for. There is nothing to backfill: an
// existing prize list IS untranslated.
func TestMigrateAddsThaiColumnsToAPreExistingAwardsTable(t *testing.T) {
	ctx := context.Background()
	store, err := Open(filepath.Join(t.TempDir(), "old.db"))
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })

	if _, err := store.db.ExecContext(ctx, `
		CREATE TABLE awards (
			id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
			image_url TEXT NOT NULL, game_slug TEXT NOT NULL, min_score INTEGER NOT NULL,
			stock INTEGER NOT NULL, active INTEGER NOT NULL, sort_order INTEGER NOT NULL,
			created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL
		);
		INSERT INTO awards VALUES ('oldawardid1','Free Coffee','Reach 40 taps.','',
			'tap-fast',40,-1,1,2,'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z');`); err != nil {
		t.Fatalf("seed old schema: %v", err)
	}

	// Twice: Migrate runs on every boot, so a second pass must be a no-op rather
	// than a duplicate-column error.
	for i := 0; i < 2; i++ {
		if err := store.Migrate(ctx); err != nil {
			t.Fatalf("migrate pass %d: %v", i+1, err)
		}
	}

	got, err := store.Awards().Get(ctx, "oldawardid1")
	if err != nil {
		t.Fatalf("get after migrate: %v", err)
	}
	if got.Name != "Free Coffee" || got.MinScore != 40 {
		t.Fatalf("the pre-existing row was not preserved: %+v", got)
	}
	if got.NameTH != "" || got.DescriptionTH != "" {
		t.Fatalf("migrated row should be untranslated, got %q / %q", got.NameTH, got.DescriptionTH)
	}
}
