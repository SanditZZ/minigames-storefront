package settings

import (
	"testing"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
)

func TestTargetScoreKeyReadsLikeEveryOtherSetting(t *testing.T) {
	if got, want := TargetScoreKey("tap-fast"), "target_score_tap_fast"; got != want {
		t.Errorf("TargetScoreKey(tap-fast) = %q, want %q", got, want)
	}
	if got, want := TargetScoreKey("precision-stop"), "target_score_precision_stop"; got != want {
		t.Errorf("TargetScoreKey(precision-stop) = %q, want %q", got, want)
	}
}

func catalog() []domain.Game {
	return []domain.Game{
		{Slug: "tap-fast", TargetScore: 60},
		{Slug: "precision-stop", TargetScore: 5},
	}
}

func setting(key, value string) domain.Setting {
	return domain.Setting{Key: key, Value: value, Type: domain.SettingInt}
}

func TestApplyTargetScoresOverridesOnlyTheGameNamed(t *testing.T) {
	got := ApplyTargetScores(catalog(), []domain.Setting{
		setting(TargetScoreKey("tap-fast"), "40"),
	})

	if got[0].TargetScore != 40 {
		t.Errorf("tap-fast benchmark = %d, want the override 40", got[0].TargetScore)
	}
	if got[1].TargetScore != 5 {
		t.Errorf("precision-stop benchmark = %d, want the catalog 5", got[1].TargetScore)
	}
}

// The catalog is the source; the override is a layer on top of it. Nothing may
// mutate the slice the caller passed in, or the registry's own copy would drift
// from what the code says a game's benchmark is.
func TestApplyTargetScoresDoesNotMutateTheCatalog(t *testing.T) {
	games := catalog()
	ApplyTargetScores(games, []domain.Setting{setting(TargetScoreKey("tap-fast"), "40")})

	if games[0].TargetScore != 60 {
		t.Errorf("catalog was mutated: tap-fast = %d, want 60", games[0].TargetScore)
	}
}

// Zero already means "unset" to the client, which then falls back to the
// leaderboard leader — the exact behaviour the fixed benchmark exists to
// prevent. A stored 0 must therefore be ignored, not applied.
func TestApplyTargetScoresIgnoresValuesThatAreNotABenchmark(t *testing.T) {
	for _, value := range []string{"0", "-5", "", "  ", "sixty", "40.5"} {
		got := ApplyTargetScores(catalog(), []domain.Setting{
			setting(TargetScoreKey("tap-fast"), value),
		})
		if got[0].TargetScore != 60 {
			t.Errorf("value %q: benchmark = %d, want the catalog 60", value, got[0].TargetScore)
		}
	}
}

func TestApplyTargetScoresToleratesWhitespaceAroundANumber(t *testing.T) {
	got := ApplyTargetScores(catalog(), []domain.Setting{
		setting(TargetScoreKey("tap-fast"), " 40 "),
	})
	if got[0].TargetScore != 40 {
		t.Errorf("benchmark = %d, want 40", got[0].TargetScore)
	}
}

func TestApplyTargetScoresIgnoresUnrelatedSettings(t *testing.T) {
	got := ApplyTargetScores(catalog(), []domain.Setting{
		setting(domain.SettingClaimTTLHours, "168"),
		setting(TargetScoreKey("no-such-game"), "99"),
	})
	if got[0].TargetScore != 60 || got[1].TargetScore != 5 {
		t.Errorf("catalog changed by unrelated settings: %+v", got)
	}
}

func TestApplyTargetScoreSingleGame(t *testing.T) {
	g := ApplyTargetScore(
		domain.Game{Slug: "tap-fast", TargetScore: 60},
		[]domain.Setting{setting(TargetScoreKey("tap-fast"), "40")},
	)
	if g.TargetScore != 40 {
		t.Errorf("benchmark = %d, want 40", g.TargetScore)
	}
}
