package game

import (
	"fmt"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
)

// SlugTapFast is the one game shipped in this vertical slice: tap a button as
// many times as you can before the timer runs out. Higher is better.
const SlugTapFast domain.GameSlug = "tap-fast"

// TapFast is its catalog definition and anti-cheat validator.
var TapFast = Definition{
	Game: domain.Game{
		Slug:        SlugTapFast,
		Name:        "Tap Fast",
		Description: "Tap the button as many times as you can before time runs out!",
		ScoreUnit:   "taps",
		Direction:   domain.HigherIsBetter,
		DurationMs:  5000,
		Enabled:     true,
	},
	Validator: validateTapFast,
}

// validateTapFast rejects impossible tap counts. A human cannot exceed roughly
// MaxTapsPerSecond, so any value above that ceiling for the elapsed time is
// treated as fabricated. Pure: no clock, no storage.
func validateTapFast(value, elapsedMs int, limits Limits) error {
	if value < 0 {
		return fmt.Errorf("score cannot be negative")
	}
	if elapsedMs <= 0 {
		return fmt.Errorf("round had no elapsed time")
	}
	maxPlausible := limits.MaxTapsPerSecond * elapsedMs / 1000
	// allow a small slack so boundary-fast players are not falsely rejected
	maxPlausible += limits.MaxTapsPerSecond
	if value > maxPlausible {
		return fmt.Errorf("score %d exceeds plausible maximum %d for %dms", value, maxPlausible, elapsedMs)
	}
	return nil
}

// SlugReactionTimer is the reflex game: wait for the screen to flip, then tap.
// The score is the reaction time in milliseconds, so LOWER is better — the
// first game in the catalog scored that way.
const SlugReactionTimer domain.GameSlug = "reaction-timer"

// ReactionCeilingMs is both the round's ceiling and the score recorded when a
// player never reacts. It is the game's DurationMs, so the client and the
// validator agree on the worst possible result without a second constant.
const ReactionCeilingMs = 3000

// ReactionTimer is its catalog definition and anti-cheat validator.
var ReactionTimer = Definition{
	Game: domain.Game{
		Slug:        SlugReactionTimer,
		Name:        "Reaction Timer",
		Description: "Wait for the flash, then tap as fast as you can. Fastest time wins!",
		ScoreUnit:   "ms",
		Direction:   domain.LowerIsBetter,
		DurationMs:  ReactionCeilingMs,
		Enabled:     true,
	},
	Validator: validateReactionTimer,
}

// validateReactionTimer rejects times no human could produce.
//
// The floor is the interesting one: simple visual reaction has a hard
// physiological limit (signal transduction plus motor response), so anything
// under MinReactionMs was either a lucky pre-tap or a fabricated number. The
// ceiling is the game's own cap, and a reaction cannot exceed the time the
// session has been open. Pure: no clock, no storage.
func validateReactionTimer(value, elapsedMs int, limits Limits) error {
	if elapsedMs <= 0 {
		return fmt.Errorf("round had no elapsed time")
	}
	if value < limits.MinReactionMs {
		return fmt.Errorf("reaction %dms is below the human minimum of %dms", value, limits.MinReactionMs)
	}
	if value > ReactionCeilingMs {
		return fmt.Errorf("reaction %dms exceeds the round ceiling of %dms", value, ReactionCeilingMs)
	}
	if value > elapsedMs {
		return fmt.Errorf("reaction %dms is longer than the %dms the session has been open", value, elapsedMs)
	}
	return nil
}

// DefaultRegistry is the catalog the server boots with. Add new games here.
func DefaultRegistry() *Registry {
	return NewRegistry(TapFast, ReactionTimer)
}
