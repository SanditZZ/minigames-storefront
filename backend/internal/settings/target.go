package settings

import (
	"strconv"
	"strings"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
)

// targetScorePrefix namespaces the per-game benchmark overrides. The slug's
// hyphens become underscores so the key reads like every other setting
// (`claim_ttl_hours`, `store_name`) rather than being the only hyphenated one.
const targetScorePrefix = "target_score_"

// TargetScoreKey is the setting an operator edits to retune one game's
// benchmark — the score at which the reveal meter reads full.
//
//	tap-fast → target_score_tap_fast
func TargetScoreKey(slug domain.GameSlug) string {
	return targetScorePrefix + strings.ReplaceAll(string(slug), "-", "_")
}

// ApplyTargetScores layers an operator's benchmark overrides over the catalog.
//
// # Why this is applied on READ rather than in Seed
//
// The obvious alternative was to have Seed write the override into the games
// table on boot. It was rejected: Seed runs once at startup, so retuning a
// benchmark would need a restart of the API to take effect — and the whole
// point of the setting is that a venue can say "our tote bag is 40 taps, not
// 60" without a deploy. Applying it here also keeps the catalog honest:
// `game.Registry` and the `games` table continue to hold what the CODE says the
// benchmark is, and the override stays visibly an override, so clearing the
// setting restores the catalog value with nothing to migrate back.
//
// A value that is absent, unparseable, or not positive is NOT an override. Zero
// already means "unset" to the client (it falls back to the leaderboard leader),
// so treating a stored 0 as an override would be a way to switch the fallback
// back on by accident — and a negative benchmark is not a thing.
func ApplyTargetScores(games []domain.Game, all []domain.Setting) []domain.Game {
	if len(games) == 0 {
		return games
	}
	overrides := targetScoreOverrides(all)
	if len(overrides) == 0 {
		return games
	}

	out := make([]domain.Game, len(games))
	copy(out, games)
	for i := range out {
		if n, ok := overrides[TargetScoreKey(out[i].Slug)]; ok {
			out[i].TargetScore = n
		}
	}
	return out
}

// ApplyTargetScore is the single-game form of ApplyTargetScores.
func ApplyTargetScore(g domain.Game, all []domain.Setting) domain.Game {
	return ApplyTargetScores([]domain.Game{g}, all)[0]
}

func targetScoreOverrides(all []domain.Setting) map[string]int {
	out := map[string]int{}
	for _, s := range all {
		if !strings.HasPrefix(s.Key, targetScorePrefix) {
			continue
		}
		n, err := strconv.Atoi(strings.TrimSpace(s.Value))
		if err != nil || n <= 0 {
			continue
		}
		out[s.Key] = n
	}
	return out
}
