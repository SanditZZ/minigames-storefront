package reward

import (
	"testing"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
)

func award(name string, min, stock, order int, active bool, slug domain.GameSlug) domain.Award {
	return domain.Award{Name: name, MinScore: min, Stock: stock, SortOrder: order, Active: active, GameSlug: slug}
}

func TestSelect_PicksHardestClearedThreshold(t *testing.T) {
	awards := []domain.Award{
		award("Coupon", 20, domain.Unlimited, 1, true, "tap-fast"),
		award("Coffee", 40, 100, 2, true, "tap-fast"),
		award("Tote", 60, 25, 3, true, "tap-fast"),
	}
	got, ok := Select(awards, "tap-fast", 45, domain.HigherIsBetter)
	if !ok || got.Name != "Coffee" {
		t.Fatalf("score 45 should win Coffee (min 40), got %q ok=%v", got.Name, ok)
	}
}

func TestSelect_NoQualifyingAward(t *testing.T) {
	awards := []domain.Award{award("Coupon", 20, domain.Unlimited, 1, true, "tap-fast")}
	if _, ok := Select(awards, "tap-fast", 10, domain.HigherIsBetter); ok {
		t.Fatal("score below every threshold should win nothing")
	}
}

func TestSelect_SkipsInactiveOutOfStockAndOtherGames(t *testing.T) {
	awards := []domain.Award{
		award("Inactive", 10, domain.Unlimited, 1, false, "tap-fast"),
		award("Empty", 10, 0, 2, true, "tap-fast"),
		award("OtherGame", 10, domain.Unlimited, 3, true, "reaction"),
		award("Valid", 10, domain.Unlimited, 4, true, "tap-fast"),
	}
	got, ok := Select(awards, "tap-fast", 50, domain.HigherIsBetter)
	if !ok || got.Name != "Valid" {
		t.Fatalf("expected the only eligible award 'Valid', got %q ok=%v", got.Name, ok)
	}
}

func TestSelect_LowerIsBetterPrefersTighterThreshold(t *testing.T) {
	// Reaction game: lower ms is better; qualifying means score <= threshold.
	awards := []domain.Award{
		award("Bronze", 500, domain.Unlimited, 1, true, "reaction"),
		award("Gold", 200, domain.Unlimited, 2, true, "reaction"),
	}
	got, ok := Select(awards, "reaction", 180, domain.LowerIsBetter)
	if !ok || got.Name != "Gold" {
		t.Fatalf("180ms should win the tighter Gold (<=200), got %q ok=%v", got.Name, ok)
	}
}

func TestSelect_WildcardGameApplies(t *testing.T) {
	awards := []domain.Award{award("AnyGamePrize", 10, domain.Unlimited, 1, true, "")}
	if _, ok := Select(awards, "tap-fast", 30, domain.HigherIsBetter); !ok {
		t.Fatal("an award with empty gameSlug should apply to any game")
	}
}
