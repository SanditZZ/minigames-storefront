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
	"time"

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
	// Get returns one round by id, or ErrNotFound. This backs the addressable
	// result URL the player app links to after a round.
	Get(ctx context.Context, id string) (domain.ScoreEntry, error)
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

// ClaimRepository stores the redeemable credentials winning rounds earn.
//
// Note what is deliberately ABSENT: there is no ListByStatus. A claim's status
// is derived from (redeemed_at, expires_at, now), so a `WHERE status = ?` would
// have to re-implement internal/claim.StatusAt in SQL — a second definition of
// "expired" that drifts from the first the moment either is edited. The store
// returns rows; the calculation decides what they are. See claim.Filter.
type ClaimRepository interface {
	// Create persists a newly issued claim. It must return ErrConflict when the
	// code is already taken, which is what lets the caller retry with a fresh
	// one rather than trusting ~39 bits of entropy never to collide.
	Create(ctx context.Context, c domain.Claim) (domain.Claim, error)
	// GetByCode resolves the code a player reads out at the counter.
	GetByCode(ctx context.Context, code string) (domain.Claim, error)
	// GetByScore finds the claim a round earned, so a result URL can show it
	// on every visit and not just the first.
	GetByScore(ctx context.Context, scoreID string) (domain.Claim, error)
	// List returns every claim, newest first. Filtering is a calculation.
	List(ctx context.Context) ([]domain.Claim, error)
	// Redeem atomically stamps redeemed_at. It must return ErrConflict if the
	// claim is already redeemed, so two admins scanning the same code at the
	// same counter cannot both hand out the prize.
	Redeem(ctx context.Context, code string, at time.Time) (domain.Claim, error)
	// Unredeem clears redeemed_at, undoing a mis-scan. It must return
	// ErrConflict when the claim is NOT redeemed, mirroring Redeem: both are
	// conditional writes, and the condition is what makes "exactly once" true in
	// each direction rather than a read the caller hopes is still current.
	//
	// It takes no timestamp because it erases one. Nothing records that an
	// un-redeem happened — see the audit-trail entry in docs/potential-features.md;
	// the claim simply reads as never collected, which is the honest state and
	// also a real gap.
	Unredeem(ctx context.Context, code string) (domain.Claim, error)
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
	Claims() ClaimRepository
	Settings() SettingRepository
	// Migrate applies schema/setup for stores that need it (no-op otherwise).
	Migrate(ctx context.Context) error
	Close() error
}
