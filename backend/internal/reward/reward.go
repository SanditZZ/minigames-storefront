// Package reward is a CALCULATIONS layer: the pure logic that decides which
// prize a score wins. Given a score and the current award configuration it
// returns the best eligible award. It performs no I/O and does not touch stock
// levels — reserving/decrementing stock is an ACTION the caller performs after
// this function names a winner.
package reward

import (
	"sort"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
)

// Eligible reports whether a score qualifies for an award, honouring the game's
// score direction. For HigherIsBetter the score must be >= the threshold; for
// LowerIsBetter (e.g. reaction time) it must be <= the threshold.
func Eligible(a domain.Award, score int, dir domain.ScoreDirection) bool {
	if dir == domain.LowerIsBetter {
		return score <= a.MinScore
	}
	return score >= a.MinScore
}

// hasStock reports whether an award can still be handed out.
func hasStock(a domain.Award) bool {
	return a.Stock == domain.Unlimited || a.Stock > 0
}

// appliesToGame reports whether an award is configured for the given game.
// An award with an empty GameSlug is a wildcard that applies to every game.
func appliesToGame(a domain.Award, slug domain.GameSlug) bool {
	return a.GameSlug == "" || a.GameSlug == slug
}

// Select picks the single best award a score wins, or (zero, false) if none.
//
// "Best" = the hardest threshold the player cleared. For HigherIsBetter that is
// the award with the greatest MinScore; for LowerIsBetter the smallest MinScore
// (the tightest time). Ties break on SortOrder then Name for determinism. Only
// active, in-stock awards for the matching game are considered.
//
// Pure and total: same inputs always give the same result, no side effects.
func Select(awards []domain.Award, slug domain.GameSlug, score int, dir domain.ScoreDirection) (domain.Award, bool) {
	candidates := make([]domain.Award, 0, len(awards))
	for _, a := range awards {
		if a.Active && appliesToGame(a, slug) && hasStock(a) && Eligible(a, score, dir) {
			candidates = append(candidates, a)
		}
	}
	if len(candidates) == 0 {
		return domain.Award{}, false
	}
	sort.SliceStable(candidates, func(i, j int) bool {
		ai, aj := candidates[i], candidates[j]
		if ai.MinScore != aj.MinScore {
			if dir == domain.LowerIsBetter {
				return ai.MinScore < aj.MinScore // tighter time is better
			}
			return ai.MinScore > aj.MinScore // higher threshold is better
		}
		if ai.SortOrder != aj.SortOrder {
			return ai.SortOrder < aj.SortOrder
		}
		return ai.Name < aj.Name
	})
	return candidates[0], true
}
