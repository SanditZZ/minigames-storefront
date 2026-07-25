package game

import (
	"testing"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
)

func TestValidateTapFast_AcceptsPlausible(t *testing.T) {
	limits := Limits{MaxTapsPerSecond: 20}
	// 45 taps over 3s = 15/s, well under the cap.
	if err := validateTapFast(45, 3000, limits); err != nil {
		t.Fatalf("plausible score should pass, got %v", err)
	}
}

func TestValidateTapFast_RejectsImpossibleRate(t *testing.T) {
	limits := Limits{MaxTapsPerSecond: 20}
	// 45 taps in 1s = 45/s, far above the cap even with slack.
	if err := validateTapFast(45, 1000, limits); err == nil {
		t.Fatal("impossible tap rate should be rejected")
	}
}

func TestValidateTapFast_RejectsNegativeAndZeroElapsed(t *testing.T) {
	limits := Limits{MaxTapsPerSecond: 20}
	if err := validateTapFast(-1, 3000, limits); err == nil {
		t.Fatal("negative score should be rejected")
	}
	if err := validateTapFast(5, 0, limits); err == nil {
		t.Fatal("zero elapsed time should be rejected")
	}
}

func TestValidateReactionTimer_AcceptsHumanReaction(t *testing.T) {
	limits := Limits{MinReactionMs: 80}
	// 240ms is a typical visual reaction, well inside both bounds.
	if err := validateReactionTimer(240, 4000, limits); err != nil {
		t.Fatalf("plausible reaction should pass, got %v", err)
	}
}

func TestValidateReactionTimer_RejectsSuperhumanReaction(t *testing.T) {
	limits := Limits{MinReactionMs: 80}
	// Under the physiological floor: a pre-tap or a fabricated number.
	if err := validateReactionTimer(30, 4000, limits); err == nil {
		t.Fatal("sub-human reaction should be rejected")
	}
	// The floor itself is acceptable, so the boundary is inclusive.
	if err := validateReactionTimer(80, 4000, limits); err != nil {
		t.Fatalf("reaction exactly at the floor should pass, got %v", err)
	}
}

func TestValidateReactionTimer_RejectsBeyondCeiling(t *testing.T) {
	limits := Limits{MinReactionMs: 80}
	if err := validateReactionTimer(ReactionCeilingMs+1, 60000, limits); err == nil {
		t.Fatal("reaction above the round ceiling should be rejected")
	}
	// The ceiling is the legitimate "never reacted" score, so it must pass.
	if err := validateReactionTimer(ReactionCeilingMs, 60000, limits); err != nil {
		t.Fatalf("the ceiling score should pass, got %v", err)
	}
}

func TestValidateReactionTimer_RejectsLongerThanTheSession(t *testing.T) {
	limits := Limits{MinReactionMs: 80}
	// A 900ms reaction cannot come from a session only 400ms old.
	if err := validateReactionTimer(900, 400, limits); err == nil {
		t.Fatal("reaction longer than the elapsed session should be rejected")
	}
	if err := validateReactionTimer(200, 0, limits); err == nil {
		t.Fatal("zero elapsed time should be rejected")
	}
}

func TestRegistry_EnabledFiltersDisabled(t *testing.T) {
	r := DefaultRegistry()
	if len(r.Enabled()) == 0 {
		t.Fatal("default registry should expose at least one enabled game")
	}
	if _, ok := r.Get(SlugTapFast); !ok {
		t.Fatal("tap-fast should be registered")
	}
	if _, ok := r.Get(SlugReactionTimer); !ok {
		t.Fatal("reaction-timer should be registered")
	}
}

// The reveal meter and the reward ladder both key off Direction, so a game
// declaring the wrong one silently inverts every prize threshold.
func TestReactionTimer_IsLowerIsBetter(t *testing.T) {
	def, ok := DefaultRegistry().Get(SlugReactionTimer)
	if !ok {
		t.Fatal("reaction-timer should be registered")
	}
	if def.Game.Direction != domain.LowerIsBetter {
		t.Fatalf("reaction-timer must be lower-is-better, got %q", def.Game.Direction)
	}
	if def.Game.DurationMs != ReactionCeilingMs {
		t.Fatalf("DurationMs %d should equal the ceiling %d so client and validator agree",
			def.Game.DurationMs, ReactionCeilingMs)
	}
}
