// Package sqlite is a concrete storage.Store backed by SQLite (pure-Go driver,
// no cgo). It is the only place SQL lives. To move to DynamoDB, add a sibling
// package implementing the same storage interfaces — no other code changes.
package sqlite

import (
	"context"
	"database/sql"
	"embed"
	"fmt"

	"github.com/sanditzz/minigames-storefront/backend/internal/storage"
	_ "modernc.org/sqlite"
)

// migrationFS is the whole directory, embedded as ONE filesystem rather than as
// one string variable per file.
//
// The difference is not tidiness. With a variable per file, adding a migration
// meant writing a new //go:embed AND remembering to call it from Migrate, and
// nothing anywhere compared the two lists — so a file that was embedded and never
// applied was a silent no-op. That happened with 008: every session insert failed
// against a table missing its column, the Go suite stayed green, and it took a
// full browser-suite run to find. `migrationsAreAllApplied` in sqlite_test.go now
// walks this filesystem and fails if any file is not named in `migrations` below,
// which is only possible because the directory is readable at runtime.
//
//go:embed migrations/*.sql
var migrationFS embed.FS

func mustMigration(name string) string {
	b, err := migrationFS.ReadFile("migrations/" + name)
	if err != nil {
		// Unreachable outside a broken build: the embed above is compile-time, so
		// a missing file fails to compile rather than reaching here.
		panic(fmt.Sprintf("read embedded migration %s: %v", name, err))
	}
	return string(b)
}

// migrations is the ordered list Migrate applies, and the list the test above
// checks the directory against. `column` empty means the file is not an ALTER and
// is safe to re-run as written (CREATE ... IF NOT EXISTS throughout); otherwise it
// names the table and column that guard it, since SQLite has no
// ADD COLUMN IF NOT EXISTS.
var migrations = []struct {
	file   string
	table  string
	column string
}{
	{file: "001_init.sql"},
	{file: "002_score_award.sql", table: "scores", column: "award_id"},
	{file: "003_claims.sql"},
	{file: "004_game_target_score.sql", table: "games", column: "target_score"},
	// Two entries, not one, because each ALTER is guarded independently. See the
	// header of 005_award_name_th.sql.
	{file: "005_award_name_th.sql", table: "awards", column: "name_th"},
	{file: "006_award_description_th.sql", table: "awards", column: "description_th"},
	{file: "007_claim_award_name_th.sql", table: "claims", column: "award_name_th"},
	{file: "008_session_challenge.sql", table: "sessions", column: "challenge"},
}

// Store implements storage.Store over a *sql.DB.
type Store struct {
	db       *sql.DB
	games    *gameRepo
	sessions *sessionRepo
	scores   *scoreRepo
	awards   *awardRepo
	claims   *claimRepo
	settings *settingRepo
}

// Open connects to (and creates if missing) the SQLite database at path.
func Open(path string) (*Store, error) {
	// _pragma options: WAL for concurrent reads, busy_timeout to avoid
	// spurious "database is locked" under light concurrency.
	dsn := fmt.Sprintf("file:%s?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)", path)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	// SQLite tolerates a single writer; keep the pool small and predictable.
	db.SetMaxOpenConns(1)
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("ping sqlite: %w", err)
	}
	s := &Store{db: db}
	s.games = &gameRepo{db: db}
	s.sessions = &sessionRepo{db: db}
	s.scores = &scoreRepo{db: db}
	s.awards = &awardRepo{db: db}
	s.claims = &claimRepo{db: db}
	s.settings = &settingRepo{db: db}
	return s, nil
}

// Migrate applies the embedded schema. Idempotent: the base schema uses
// IF NOT EXISTS throughout, and each additive column migration is guarded by a
// column-existence check (SQLite has no ADD COLUMN IF NOT EXISTS), so running
// this on every boot — against a fresh or an already-migrated database — is safe.
func (s *Store) Migrate(ctx context.Context) error {
	for _, m := range migrations {
		sqlText := mustMigration(m.file)
		// No column named means the file is not an ALTER: it is CREATE ... IF NOT
		// EXISTS throughout and re-runnable as written.
		if m.column == "" {
			if _, err := s.db.ExecContext(ctx, sqlText); err != nil {
				return fmt.Errorf("apply %s: %w", m.file, err)
			}
			continue
		}
		if err := s.addColumnIfMissing(ctx, m.table, m.column, sqlText); err != nil {
			return fmt.Errorf("apply %s: %w", m.file, err)
		}
	}
	return nil
}

// addColumnIfMissing runs an ALTER TABLE ... ADD COLUMN migration only when the
// column is absent, making the migration re-runnable.
func (s *Store) addColumnIfMissing(ctx context.Context, table, column, migration string) error {
	has, err := s.hasColumn(ctx, table, column)
	if err != nil {
		return err
	}
	if has {
		return nil
	}
	if _, err := s.db.ExecContext(ctx, migration); err != nil {
		return fmt.Errorf("add %s.%s: %w", table, column, err)
	}
	return nil
}

// hasColumn reports whether a table already defines a column.
func (s *Store) hasColumn(ctx context.Context, table, column string) (bool, error) {
	// table is a package-internal constant, never user input.
	rows, err := s.db.QueryContext(ctx, fmt.Sprintf("PRAGMA table_info(%s)", table))
	if err != nil {
		return false, fmt.Errorf("inspect %s: %w", table, err)
	}
	defer rows.Close()
	for rows.Next() {
		var (
			cid, notnull, pk int
			name, ctype      string
			dflt             sql.NullString
		)
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			return false, fmt.Errorf("scan %s column: %w", table, err)
		}
		if name == column {
			return true, nil
		}
	}
	return false, rows.Err()
}

func (s *Store) Games() storage.GameRepository       { return s.games }
func (s *Store) Sessions() storage.SessionRepository { return s.sessions }
func (s *Store) Scores() storage.ScoreRepository     { return s.scores }
func (s *Store) Awards() storage.AwardRepository     { return s.awards }
func (s *Store) Claims() storage.ClaimRepository     { return s.claims }
func (s *Store) Settings() storage.SettingRepository { return s.settings }

func (s *Store) Close() error { return s.db.Close() }
