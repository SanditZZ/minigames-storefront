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

// DefaultRegistry is the catalog the server boots with. Add new games here.
func DefaultRegistry() *Registry {
	return NewRegistry(TapFast)
}
