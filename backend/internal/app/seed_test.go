package app

import (
	"testing"
	"time"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
	"github.com/sanditzz/minigames-storefront/backend/internal/game"
)

// TestBenchmarkMatchesHardestStarterAward asserts the convention that until now
// was stated in a comment in seed.go and by nothing else: every game's
// TargetScore equals the MinScore of its hardest starter award.
//
// The convention is what makes the reveal honest — filling the meter and
// winning the top prize are meant to be the same event. Break it and there is
// no error anywhere: a player is told they maxed the benchmark while winning
// nothing, or wins the tote bag with the meter three-quarters full, and the
// only symptom is a customer at the counter arguing about it.
//
// "Hardest" runs in opposite directions per game — tap-fast wants MORE taps,
// reaction-timer and precision-stop want a SMALLER number — so the test reads
// the game's own ScoreDirection rather than assuming.
func TestBenchmarkMatchesHardestStarterAward(t *testing.T) {
	awards := starterAwards(time.Now())

	for _, g := range game.DefaultRegistry().Games() {
		hardest, ok := hardestStarter(awards, g)
		if !ok {
			t.Errorf("%s: no starter award — a new game must ship with its prize ladder", g.Slug)
			continue
		}
		if g.TargetScore != hardest.MinScore {
			t.Errorf(
				"%s: TargetScore = %d but the hardest starter award (%q) needs %d.\n"+
					"Filling the reveal meter must be the same event as winning the top prize; "+
					"change one to match the other.",
				g.Slug, g.TargetScore, hardest.Name, hardest.MinScore,
			)
		}
	}
}

// Every game must declare a benchmark: zero means "unset", which puts the
// client back on the leaderboard-leader fallback the fixed benchmark exists to
// replace.
func TestEveryStarterGameDeclaresAPositiveBenchmark(t *testing.T) {
	for _, g := range game.DefaultRegistry().Games() {
		if g.TargetScore <= 0 {
			t.Errorf("%s: TargetScore = %d, want a positive benchmark", g.Slug, g.TargetScore)
		}
	}
}

// hardestStarter finds the award for a game whose threshold is the most
// demanding, respecting the game's scoring direction.
func hardestStarter(awards []domain.Award, g domain.Game) (domain.Award, bool) {
	var best domain.Award
	found := false

	for _, a := range awards {
		if a.GameSlug != g.Slug {
			continue
		}
		if !found {
			best, found = a, true
			continue
		}
		harder := a.MinScore > best.MinScore
		if g.Direction == domain.LowerIsBetter {
			harder = a.MinScore < best.MinScore
		}
		if harder {
			best = a
		}
	}
	return best, found
}
