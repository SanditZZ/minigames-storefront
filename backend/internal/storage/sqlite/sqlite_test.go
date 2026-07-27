package sqlite

import (
	"strings"
	"testing"
)

// TestEveryMigrationFileIsApplied closes the hole that adding a migration and
// forgetting to wire it up used to leave.
//
// The old arrangement was one //go:embed variable per file plus a hand-written
// call per file in Migrate, with nothing comparing the two. A file that was
// embedded and never applied was a silent no-op: 008_session_challenge.sql landed
// that way, every session insert failed against a table missing its column, the
// whole Go suite stayed green, and it cost a full browser-suite run to diagnose.
//
// This is the check that makes the directory and the list agree. It is only
// possible because the migrations are now one embed.FS rather than eight strings
// — a directory can be walked at runtime; a set of variables cannot.
func TestEveryMigrationFileIsApplied(t *testing.T) {
	entries, err := migrationFS.ReadDir("migrations")
	if err != nil {
		t.Fatalf("read migrations dir: %v", err)
	}

	applied := make(map[string]bool, len(migrations))
	for _, m := range migrations {
		applied[m.file] = true
	}

	var found int
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		found++
		if !applied[e.Name()] {
			t.Errorf("migrations/%s is embedded but never applied — add it to the `migrations` list in sqlite.go", e.Name())
		}
	}
	if found == 0 {
		t.Fatal("no migrations found; the embed pattern is not matching the directory")
	}

	// And the other direction: a list entry naming a file that does not exist
	// would panic at boot rather than here, which is a worse place to find out.
	for _, m := range migrations {
		if _, err := migrationFS.ReadFile("migrations/" + m.file); err != nil {
			t.Errorf("migrations list names %s, which is not in the directory: %v", m.file, err)
		}
	}
	if found != len(migrations) {
		t.Errorf("directory has %d .sql files but the list has %d entries", found, len(migrations))
	}
}

// Re-runnability is covered by TestMigrateIsIdempotent in claims_test.go, which
// additionally checks that rows survive a second pass — a stronger claim than
// "no error", and the one that matters on a live database.

// Every ALTER entry has to name a column that the migration actually adds, or its
// guard checks the wrong thing and the file either re-runs forever or never runs
// at all. Cheap to verify against the file's own text.
func TestAlterMigrationsGuardTheColumnTheyAdd(t *testing.T) {
	for _, m := range migrations {
		if m.column == "" {
			continue
		}
		body := mustMigration(m.file)
		if !strings.Contains(body, m.column) {
			t.Errorf("%s is guarded on column %q, which the file never mentions", m.file, m.column)
		}
		if !strings.Contains(strings.ToUpper(body), "ALTER TABLE") {
			t.Errorf("%s is guarded as an ALTER but contains none", m.file)
		}
	}
}
