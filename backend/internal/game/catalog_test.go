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

func TestValidatePrecisionStop_AcceptsAPerfectStop(t *testing.T) {
	// The point of the whole game: 0 is the goal, not an impossible value. A
	// validator that rejected it would reject the best round anyone can play.
	if err := validatePrecisionStop(0, 2000, DefaultLimits()); err != nil {
		t.Fatalf("a perfect stop must be accepted, got %v", err)
	}
	if err := validatePrecisionStop(PrecisionTrackHalf, 2000, DefaultLimits()); err != nil {
		t.Fatalf("stopping at the far end is the worst legal score, got %v", err)
	}
}

func TestValidatePrecisionStop_RejectsOffTrackAndNoTime(t *testing.T) {
	if err := validatePrecisionStop(PrecisionTrackHalf+1, 2000, DefaultLimits()); err == nil {
		t.Fatal("a miss wider than the track should be rejected")
	}
	if err := validatePrecisionStop(-1, 2000, DefaultLimits()); err == nil {
		t.Fatal("a negative distance should be rejected")
	}
	if err := validatePrecisionStop(10, 0, DefaultLimits()); err == nil {
		t.Fatal("zero elapsed time should be rejected")
	}
}

func TestRegistry_EnabledFiltersDisabled(t *testing.T) {
	r := DefaultRegistry()
	if len(r.Enabled()) == 0 {
		t.Fatal("default registry should expose at least one enabled game")
	}
	for _, slug := range []domain.GameSlug{SlugTapFast, SlugReactionTimer, SlugPrecisionStop} {
		if _, ok := r.Get(slug); !ok {
			t.Fatalf("%s should be registered", slug)
		}
	}
}

// The reveal meter and the reward ladder both key off Direction, so a game
// declaring the wrong one silently inverts every prize threshold.
func TestPrecisionStop_IsLowerIsBetter(t *testing.T) {
	def, ok := DefaultRegistry().Get(SlugPrecisionStop)
	if !ok {
		t.Fatal("precision-stop should be registered")
	}
	if def.Game.Direction != domain.LowerIsBetter {
		t.Fatalf("precision-stop must be lower-is-better, got %q", def.Game.Direction)
	}
	if def.Game.TargetScore != PrecisionTargetOff {
		t.Fatalf("TargetScore %d should be the benchmark constant %d",
			def.Game.TargetScore, PrecisionTargetOff)
	}
}

// TestEveryGameDeclaresATargetScore is the guard that keeps the client's
// benchmark fallback unreachable, and it is the real fix for the bug Precision
// Stop exposed.
//
// The reveal meter can only scale honestly against something. Given no
// TargetScore it falls back to the leaderboard leader, which is the board
// scaling against itself: flattering on an empty board, and permanently broken
// on a lower-is-better game once a leader scores 0 — the meter then reads full
// for everyone, forever, because nothing beats perfect. Requiring a benchmark
// here turns that from a silent maths failure into a red test the moment
// someone adds a game without one.
func TestEveryGameDeclaresATargetScore(t *testing.T) {
	for _, g := range DefaultRegistry().Games() {
		if g.TargetScore <= 0 {
			t.Errorf("%s has TargetScore %d; every game needs a positive benchmark "+
				"or its reveal meter scales against the leaderboard and lies",
				g.Slug, g.TargetScore)
		}
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
