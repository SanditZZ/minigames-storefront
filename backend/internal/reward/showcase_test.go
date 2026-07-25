package reward

import (
	"testing"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
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
	got := names(Showcase(awards, "tap-fast", domain.HigherIsBetter))
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
	got := names(Showcase(awards, "reaction-timer", domain.LowerIsBetter))
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
	got := names(Showcase(awards, "tap-fast", domain.HigherIsBetter))
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
	got := Showcase(awards, "tap-fast", domain.HigherIsBetter)
	if !got[0].SoldOut {
		t.Fatal("an award with zero stock should be flagged sold out")
	}
	if got[1].SoldOut || got[2].SoldOut {
		t.Fatal("in-stock and unlimited awards should not be flagged sold out")
	}
	// PublicAward has no stock field at all — this is the compile-time guarantee
	// that a remaining-units count can never reach an unauthenticated caller.
}
