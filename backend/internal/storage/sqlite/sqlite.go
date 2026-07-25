// Package sqlite is a concrete storage.Store backed by SQLite (pure-Go driver,
// no cgo). It is the only place SQL lives. To move to DynamoDB, add a sibling
// package implementing the same storage interfaces — no other code changes.
package sqlite

import (
	"context"
	"database/sql"
	_ "embed"
	"fmt"

	"github.com/sanditzz/minigames-storefront/backend/internal/storage"
	_ "modernc.org/sqlite"
)

//go:embed migrations/001_init.sql
var schemaSQL string

//go:embed migrations/002_score_award.sql
var scoreAwardSQL string

//go:embed migrations/003_claims.sql
var claimsSQL string

//go:embed migrations/004_game_target_score.sql
var gameTargetScoreSQL string

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
	if _, err := s.db.ExecContext(ctx, schemaSQL); err != nil {
		return fmt.Errorf("apply schema: %w", err)
	}
	if err := s.addColumnIfMissing(ctx, "scores", "award_id", scoreAwardSQL); err != nil {
		return err
	}
	// A whole new table, so it needs no column-existence guard — the file is
	// CREATE ... IF NOT EXISTS throughout, like the base schema.
	if _, err := s.db.ExecContext(ctx, claimsSQL); err != nil {
		return fmt.Errorf("apply claims schema: %w", err)
	}
	if err := s.addColumnIfMissing(ctx, "games", "target_score", gameTargetScoreSQL); err != nil {
		return err
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
