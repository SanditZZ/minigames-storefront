// Package storage defines the repository interfaces that isolate the rest of
// the app from any specific database. Handlers and calculations depend only on
// these interfaces, so swapping SQLite for DynamoDB (or Postgres, or an
// in-memory fake in tests) means implementing this package once — nothing else
// changes.
//
// Each repository is deliberately narrow and expresses access patterns, not
// tables. That keeps it honest for a key/value store like DynamoDB where you
// design around queries, not joins.
package storage

import (
	"context"
	"errors"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
)

// ErrNotFound is returned by repositories when a lookup finds nothing. Callers
// compare with errors.Is so the sentinel is storage-implementation agnostic.
var ErrNotFound = errors.New("storage: not found")

// ErrConflict is returned when a write violates a uniqueness/optimistic
// constraint (e.g. consuming an already-consumed session).
var ErrConflict = errors.New("storage: conflict")

// GameRepository is read-mostly reference data for the game catalog.
type GameRepository interface {
	List(ctx context.Context) ([]domain.Game, error)
	Get(ctx context.Context, slug domain.GameSlug) (domain.Game, error)
	Upsert(ctx context.Context, g domain.Game) error
}

// SessionRepository issues and consumes single-use play permits.
type SessionRepository interface {
	Create(ctx context.Context, s domain.Session) error
	Get(ctx context.Context, token string) (domain.Session, error)
	// Consume atomically marks a session used. It must return ErrConflict if
	// the session is already consumed, so double-submit is impossible.
	Consume(ctx context.Context, token string) (domain.Session, error)
}

// ScoreRepository persists results and answers leaderboard queries.
type ScoreRepository interface {
	Create(ctx context.Context, e domain.ScoreEntry) (domain.ScoreEntry, error)
	// Top returns the best entries for a game, ordered by the game's direction.
	Top(ctx context.Context, slug domain.GameSlug, direction domain.ScoreDirection, limit int) ([]domain.ScoreEntry, error)
}

// AwardRepository is the admin-CRUD store for prizes.
type AwardRepository interface {
	List(ctx context.Context) ([]domain.Award, error)
	Get(ctx context.Context, id string) (domain.Award, error)
	Create(ctx context.Context, a domain.Award) (domain.Award, error)
	Update(ctx context.Context, a domain.Award) (domain.Award, error)
	Delete(ctx context.Context, id string) error
	// DecrementStock atomically reduces stock by one for a limited award,
	// returning ErrConflict if it is already out of stock. No-op for Unlimited.
	DecrementStock(ctx context.Context, id string) error
}

// SettingRepository is the admin-CRUD store for configuration knobs.
type SettingRepository interface {
	List(ctx context.Context) ([]domain.Setting, error)
	Get(ctx context.Context, key string) (domain.Setting, error)
	Upsert(ctx context.Context, s domain.Setting) (domain.Setting, error)
	Delete(ctx context.Context, key string) error
}

// Store is the aggregate root: one object handing out every repository plus
// lifecycle. A new backend implements this and the app is agnostic to which.
type Store interface {
	Games() GameRepository
	Sessions() SessionRepository
	Scores() ScoreRepository
	Awards() AwardRepository
	Settings() SettingRepository
	// Migrate applies schema/setup for stores that need it (no-op otherwise).
	Migrate(ctx context.Context) error
	Close() error
}
