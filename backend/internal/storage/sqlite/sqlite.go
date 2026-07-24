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

// Store implements storage.Store over a *sql.DB.
type Store struct {
	db       *sql.DB
	games    *gameRepo
	sessions *sessionRepo
	scores   *scoreRepo
	awards   *awardRepo
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
	s.settings = &settingRepo{db: db}
	return s, nil
}

// Migrate applies the embedded schema. Idempotent (all statements use IF NOT EXISTS).
func (s *Store) Migrate(ctx context.Context) error {
	if _, err := s.db.ExecContext(ctx, schemaSQL); err != nil {
		return fmt.Errorf("apply schema: %w", err)
	}
	return nil
}

func (s *Store) Games() storage.GameRepository       { return s.games }
func (s *Store) Sessions() storage.SessionRepository { return s.sessions }
func (s *Store) Scores() storage.ScoreRepository     { return s.scores }
func (s *Store) Awards() storage.AwardRepository     { return s.awards }
func (s *Store) Settings() storage.SettingRepository { return s.settings }

func (s *Store) Close() error { return s.db.Close() }
