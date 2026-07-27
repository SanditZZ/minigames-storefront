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

// Definition is the catalog entry plus the pure rules for judging a round.
//
// A game answers "was this score real?" in one of two ways, and a Definition
// carries whichever it uses:
//
//   - A Validator, for a game the client scores itself. The client reports a
//     number and the server decides whether that number is PLAUSIBLE. This is
//     as far as anti-cheat can go when the server saw none of the round, and
//     it only works where the body has a limit to appeal to — a tap rate has a
//     ceiling, a reaction has a floor. Precision Stop has neither, which is
//     exactly why its validator can do so little.
//
//   - A Scorer, for a game the SERVER scores. The client reports what the
//     player did — not what it was worth — and the server replays the round to
//     compute the number itself. Nothing is being trusted and then checked;
//     the client's opinion of its own score is never read.
//
// Scorer is the better answer wherever a game's rules can be replayed from its
// inputs, and Stack is the first game written to it. Precision Stop is the
// obvious next one: its stop time is a single event, and sending that instead
// of a distance would make the one game in the catalog with no plausibility
// check at all exactly checkable. See docs/potential-features.md.
//
// Both are optional and neither is required; a Definition with neither accepts
// whatever it is told, which is a choice worth making out loud rather than by
// omission.
type Definition struct {
	Game      domain.Game
	Validator Validator
	// Challenge returns the round description the client needs in order to
	// render a scored game — today the physics constants, so the tuning has one
	// home rather than one per simulation. Nil for games that need none.
	//
	// It is called per session and its result is serialised straight to JSON,
	// so it must return a value, never a pointer into shared state.
	Challenge Challenge
	// Scorer computes the authoritative score from the events the client
	// reported. When present it REPLACES the Validator path entirely: the
	// client's `value` is not read, not compared, and not recorded.
	Scorer Scorer
}

// Validator returns nil if value is an acceptable score for a round that lasted
// elapsedMs, given tunable limits, or an error explaining why it is rejected.
type Validator func(value int, elapsedMs int, limits Limits) error

// Challenge produces the per-round data a scored game's client needs.
type Challenge func() any

// Scorer replays a round from the events the client reported and returns the
// score it earned, or an error if the events could not describe a real round.
//
// Events are millisecond offsets from the start of play — the only shape the
// two games that want a Scorer actually need (Stack's drops, and Precision
// Stop's single stop). A game needing richer events than a timeline of moments
// is the point at which this becomes a per-game type rather than []int; that
// is a change to make when such a game arrives, not in anticipation of one.
//
// The distinction the implementation must keep: an ERROR means the events could
// not have come from a real round, and the submission is rejected. A low score
// — including zero — is an ordinary outcome and must not be an error.
type Scorer func(events []int, durationMs int) (int, error)

// Limits are runtime-tunable anti-cheat bounds, sourced from the Settings store
// and passed in explicitly so this layer stays pure.
type Limits struct {
	MaxTapsPerSecond int
	// MinReactionMs is the fastest visual reaction treated as human. Below it a
	// submission is a pre-tap or a fabrication, not a result.
	MinReactionMs int
}

// DefaultLimits are conservative fallbacks when a setting is missing.
func DefaultLimits() Limits {
	return Limits{MaxTapsPerSecond: 20, MinReactionMs: 80}
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
