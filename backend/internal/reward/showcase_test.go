package reward

import (
	"testing"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
	"github.com/sanditzz/minigames-storefront/backend/internal/i18n"
)

func showcaseAward(name string, slug domain.GameSlug, min, stock int, active bool) domain.Award {
	return domain.Award{
		Name:     name,
		GameSlug: slug,
		MinScore: min,
		Stock:    stock,
		Active:   active,
	}
}

func names(prizes []PublicAward) []string {
	out := make([]string, len(prizes))
	for i, p := range prizes {
		out[i] = p.Name
	}
	return out
}

func TestShowcase_OrdersEasiestFirstForHigherIsBetter(t *testing.T) {
	awards := []domain.Award{
		showcaseAward("Tote", "tap-fast", 60, domain.Unlimited, true),
		showcaseAward("Coupon", "tap-fast", 20, domain.Unlimited, true),
		showcaseAward("Coffee", "tap-fast", 40, domain.Unlimited, true),
	}
	got := names(Showcase(awards, "tap-fast", domain.HigherIsBetter, i18n.English))
	want := []string{"Coupon", "Coffee", "Tote"}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("higher-is-better order = %v, want %v", got, want)
		}
	}
}

func TestShowcase_OrdersEasiestFirstForLowerIsBetter(t *testing.T) {
	// A looser (larger) time is the easier prize, so the ladder inverts.
	awards := []domain.Award{
		showcaseAward("Tote", "reaction-timer", 220, domain.Unlimited, true),
		showcaseAward("Coupon", "reaction-timer", 400, domain.Unlimited, true),
		showcaseAward("Coffee", "reaction-timer", 300, domain.Unlimited, true),
	}
	got := names(Showcase(awards, "reaction-timer", domain.LowerIsBetter, i18n.English))
	want := []string{"Coupon", "Coffee", "Tote"}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("lower-is-better order = %v, want %v", got, want)
		}
	}
}

func TestShowcase_FiltersInactiveAndOtherGames(t *testing.T) {
	awards := []domain.Award{
		showcaseAward("Mine", "tap-fast", 20, domain.Unlimited, true),
		showcaseAward("Hidden", "tap-fast", 30, domain.Unlimited, false),
		showcaseAward("OtherGame", "reaction-timer", 300, domain.Unlimited, true),
		showcaseAward("Wildcard", "", 10, domain.Unlimited, true),
	}
	got := names(Showcase(awards, "tap-fast", domain.HigherIsBetter, i18n.English))
	want := []string{"Wildcard", "Mine"}
	if len(got) != len(want) {
		t.Fatalf("showcase = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("showcase = %v, want %v", got, want)
		}
	}
}

// Scarcity is public; the exact stock level is not.
func TestShowcase_FlagsSoldOutWithoutLeakingStock(t *testing.T) {
	awards := []domain.Award{
		showcaseAward("Gone", "tap-fast", 20, 0, true),
		showcaseAward("Limited", "tap-fast", 40, 7, true),
		showcaseAward("Endless", "tap-fast", 60, domain.Unlimited, true),
	}
	got := Showcase(awards, "tap-fast", domain.HigherIsBetter, i18n.English)
	if !got[0].SoldOut {
		t.Fatal("an award with zero stock should be flagged sold out")
	}
	if got[1].SoldOut || got[2].SoldOut {
		t.Fatal("in-stock and unlimited awards should not be flagged sold out")
	}
	// PublicAward has no stock field at all — this is the compile-time guarantee
	// that a remaining-units count can never reach an unauthenticated caller.
}

func showcaseGame(slug domain.GameSlug, dir domain.ScoreDirection) domain.Game {
	return domain.Game{Slug: slug, Direction: dir, Enabled: true}
}

// The batch must be per-game, not a pooled list: a threshold means nothing
// without the game it belongs to, and the two games below share a prize name at
// wildly different numbers.
func TestShowcaseAll_KeepsEachGamesLadderSeparate(t *testing.T) {
	awards := []domain.Award{
		showcaseAward("Coffee", "tap-fast", 40, domain.Unlimited, true),
		showcaseAward("Coffee", "reaction-timer", 300, domain.Unlimited, true),
		showcaseAward("Tote", "tap-fast", 60, domain.Unlimited, true),
	}
	games := []domain.Game{
		showcaseGame("tap-fast", domain.HigherIsBetter),
		showcaseGame("reaction-timer", domain.LowerIsBetter),
	}
	got := ShowcaseAll(awards, games, i18n.English)
	if len(got) != 2 {
		t.Fatalf("batch has %d entries, want one per game", len(got))
	}
	if got[0].GameSlug != "tap-fast" || got[1].GameSlug != "reaction-timer" {
		t.Fatalf("batch order = %v, %v; want the catalog order it was given",
			got[0].GameSlug, got[1].GameSlug)
	}
	if names := names(got[0].Prizes); len(names) != 2 || names[0] != "Coffee" {
		t.Fatalf("tap-fast prizes = %v, want [Coffee Tote]", names)
	}
	if got[1].Prizes[0].MinScore != 300 {
		t.Fatalf("reaction-timer Coffee threshold = %d, want its own 300",
			got[1].Prizes[0].MinScore)
	}
}

// The response describes the catalog, so a game that pays out nothing is still
// in it — the client renders the picker from this order and an absent entry
// would read as an absent game.
func TestShowcaseAll_KeepsGamesWithNoActivePrizes(t *testing.T) {
	awards := []domain.Award{
		showcaseAward("Hidden", "stack", 5, domain.Unlimited, false),
	}
	games := []domain.Game{showcaseGame("stack", domain.HigherIsBetter)}
	got := ShowcaseAll(awards, games, i18n.English)
	if len(got) != 1 || got[0].GameSlug != "stack" {
		t.Fatalf("batch = %v, want one empty entry for stack", got)
	}
	if len(got[0].Prizes) != 0 {
		t.Fatalf("stack prizes = %v, want none active", got[0].Prizes)
	}
	// Empty rather than nil: it marshals as [] and the client maps over it.
	if got[0].Prizes == nil {
		t.Fatal("prizes should marshal as [] rather than null")
	}
}

// One reading of the awards table has to answer every game identically to the
// per-game endpoint, or the landing screen and a game's own page disagree.
func TestShowcaseAll_MatchesPerGameShowcase(t *testing.T) {
	awards := []domain.Award{
		showcaseAward("Coffee", "tap-fast", 40, 0, true),
		showcaseAward("Wildcard", "", 10, domain.Unlimited, true),
		showcaseAward("Tote", "tap-fast", 60, domain.Unlimited, true),
	}
	games := []domain.Game{showcaseGame("tap-fast", domain.HigherIsBetter)}
	batched := ShowcaseAll(awards, games, i18n.Thai)[0].Prizes
	single := Showcase(awards, "tap-fast", domain.HigherIsBetter, i18n.Thai)
	if len(batched) != len(single) {
		t.Fatalf("batched %d prizes, single-game %d", len(batched), len(single))
	}
	for i := range single {
		if batched[i] != single[i] {
			t.Fatalf("prize %d: batched %+v, single-game %+v", i, batched[i], single[i])
		}
	}
}
