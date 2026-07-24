// Package game is a CALCULATIONS layer: pure functions describing the game
// catalog and how a submitted score is validated. No I/O, no storage, no time
// side effects — every function takes its inputs explicitly and returns a
// value, which makes the scoring rules trivially unit-testable.
//
// The registry here is the extension point: adding a new mini-game means adding
// a Definition (data) and, if it needs bespoke anti-cheat, a Validator (a pure
// func). Nothing in the HTTP or storage layers needs to change.
package game

import (
	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
)

// Definition is the catalog entry plus its pure validation rule. The Validator
// decides whether a raw client-reported score is plausible for a round of the
// given elapsed duration — the server's defence against fabricated scores.
type Definition struct {
	Game      domain.Game
	Validator Validator
}

// Validator returns nil if value is an acceptable score for a round that lasted
// elapsedMs, given tunable limits, or an error explaining why it is rejected.
type Validator func(value int, elapsedMs int, limits Limits) error

// Limits are runtime-tunable anti-cheat bounds, sourced from the Settings store
// and passed in explicitly so this layer stays pure.
type Limits struct {
	MaxTapsPerSecond int
}

// DefaultLimits are conservative fallbacks when a setting is missing.
func DefaultLimits() Limits {
	return Limits{MaxTapsPerSecond: 20}
}

// Registry indexes definitions by slug. It is plain data assembled once at
// startup and read concurrently thereafter (never mutated), so no locking.
type Registry struct {
	bySlug map[domain.GameSlug]Definition
	order  []domain.GameSlug
}

// NewRegistry builds a registry from an ordered list of definitions.
func NewRegistry(defs ...Definition) *Registry {
	r := &Registry{bySlug: make(map[domain.GameSlug]Definition, len(defs))}
	for _, d := range defs {
		r.bySlug[d.Game.Slug] = d
		r.order = append(r.order, d.Game.Slug)
	}
	return r
}

// Get returns the definition for a slug, and whether it exists.
func (r *Registry) Get(slug domain.GameSlug) (Definition, bool) {
	d, ok := r.bySlug[slug]
	return d, ok
}

// Games returns the catalog in registration order.
func (r *Registry) Games() []domain.Game {
	out := make([]domain.Game, 0, len(r.order))
	for _, slug := range r.order {
		out = append(out, r.bySlug[slug].Game)
	}
	return out
}

// Enabled returns only the games currently enabled for play.
func (r *Registry) Enabled() []domain.Game {
	out := make([]domain.Game, 0, len(r.order))
	for _, slug := range r.order {
		if g := r.bySlug[slug].Game; g.Enabled {
			out = append(out, g)
		}
	}
	return out
}
