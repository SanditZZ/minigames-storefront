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
		TargetScore: 60,
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
		TargetScore: 220,
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

// SlugPrecisionStop is the timing game: a marker sweeps a track and the player
// stops it as close to the centre as they can. The score is how far off centre
// they landed, so LOWER is better — and, unlike a reaction time, a perfect
// round scores exactly 0. That is the whole reason this game exists: 0 is the
// GOAL here rather than an impossibility, which is the one case the reveal
// meter used to assume away (see domain.Game.TargetScore).
const SlugPrecisionStop domain.GameSlug = "precision-stop"

// PrecisionTrackHalf is the virtual half-width of the track, and therefore the
// worst possible score: stopping at either end is PrecisionTrackHalf off centre.
//
// It is a VIRTUAL unit, not pixels. The client normalises its rendered track to
// this scale before reporting, so a phone and a kiosk screen produce comparable
// scores and the server can bound-check a submission without knowing anything
// about the display it came from.
const PrecisionTrackHalf = 100

// PrecisionTargetOff is the house benchmark: land within this of centre and the
// reveal meter reads full. It is the threshold of the game's top starter prize
// (see app.starterAwards), so "filled the tower" and "won the best prize" mean
// the same thing to a player rather than two unrelated scales.
const PrecisionTargetOff = 5

// PrecisionStop is its catalog definition and anti-cheat validator.
var PrecisionStop = Definition{
	Game: domain.Game{
		Slug:        SlugPrecisionStop,
		Name:        "Precision Stop",
		Description: "Stop the marker dead centre. The closer you land, the lower your score — and lowest wins!",
		ScoreUnit:   "off",
		Direction:   domain.LowerIsBetter,
		DurationMs:  6000,
		TargetScore: PrecisionTargetOff,
		Enabled:     true,
	},
	Validator: validatePrecisionStop,
}

// validatePrecisionStop bounds-checks a reported miss distance.
//
// Bounds are honestly all the server can check here. The marker's speed is
// fixed but its starting phase is drawn on the client, so there is no shared
// secret to recompute the stop position from — unlike the tap rate, which has a
// physiological ceiling, or a reaction, which has a physiological floor. Making
// this game cheat-proof means sending the input events and scoring server-side
// (the "server-authoritative scoring" item in docs/potential-features.md); until
// then, saying so plainly beats a validator that looks stricter than it is.
//
// A score of 0 is explicitly LEGAL: it is a perfect stop, the outcome the game
// is played for. Rejecting or nudging it would corrupt the exact result the
// player is aiming at. Pure: no clock, no storage.
func validatePrecisionStop(value, elapsedMs int, limits Limits) error {
	if elapsedMs <= 0 {
		return fmt.Errorf("round had no elapsed time")
	}
	if value < 0 {
		return fmt.Errorf("distance from centre cannot be negative")
	}
	if value > PrecisionTrackHalf {
		return fmt.Errorf("distance %d is off a track only %d wide either side of centre", value, PrecisionTrackHalf)
	}
	return nil
}

// DefaultRegistry is the catalog the server boots with. Add new games here.
func DefaultRegistry() *Registry {
	return NewRegistry(TapFast, ReactionTimer, PrecisionStop, Stack)
}
