package reward

import (
	"testing"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
	"github.com/sanditzz/minigames-storefront/backend/internal/i18n"
)

func TestTextPrefersTheReadersLanguage(t *testing.T) {
	if got := Text("Free Coffee", "กาแฟฟรี", i18n.Thai); got != "กาแฟฟรี" {
		t.Fatalf("Thai reader got %q", got)
	}
	// An English reader gets English even when a Thai translation exists — the
	// pick is not "whatever is filled in".
	if got := Text("Free Coffee", "กาแฟฟรี", i18n.English); got != "Free Coffee" {
		t.Fatalf("English reader got %q", got)
	}
}

func TestTextFallsBackWhenTheTranslationIsMissing(t *testing.T) {
	if got := Text("Free Coffee", "", i18n.Thai); got != "Free Coffee" {
		t.Fatalf("untranslated award should read English, got %q", got)
	}
	// A locale with no column of its own has nothing to pick and must not fall
	// through to Thai. This is the case that breaks the day a third locale is
	// added by writing only the negotiation half.
	if got := Text("Free Coffee", "กาแฟฟรี", i18n.Locale("ja")); got != "Free Coffee" {
		t.Fatalf("unknown locale got %q, want the English fallback", got)
	}
}

// The per-field rule is the whole design, so it gets the test the doc promises:
// half a translation shows half in Thai rather than reverting the pair.
func TestLocalizedAwardFallsBackFieldByField(t *testing.T) {
	a := domain.Award{
		Name:        "Free Coffee",
		Description: "Reach 40 taps to earn a free coffee.",
		NameTH:      "กาแฟฟรี",
		// DescriptionTH deliberately absent.
	}
	got := LocalizedAward(a, i18n.Thai)
	if got.Name != "กาแฟฟรี" {
		t.Fatalf("Name = %q, want the Thai one", got.Name)
	}
	if got.Description != a.Description {
		t.Fatalf("Description = %q, want the English fallback", got.Description)
	}
}

// The awards come from the repository and are shared with everything else
// reading them in that request, so localizing must not write through them.
func TestLocalizedAwardDoesNotMutateItsInput(t *testing.T) {
	a := domain.Award{Name: "Free Coffee", NameTH: "กาแฟฟรี"}
	_ = LocalizedAward(a, i18n.Thai)
	if a.Name != "Free Coffee" {
		t.Fatalf("input was mutated: Name = %q", a.Name)
	}
}

// A claim reads its OWN snapshot, never the award. This is the test that fails
// if someone "simplifies" the claim's Thai name into a lookup — which would
// reintroduce, in a second language, exactly the history-rewriting bug the
// snapshot exists to prevent.
func TestLocalizedClaimReadsItsSnapshot(t *testing.T) {
	c := domain.Claim{AwardName: "Free Coffee", AwardNameTH: "กาแฟฟรี"}
	if got := LocalizedClaim(c, i18n.Thai).AwardName; got != "กาแฟฟรี" {
		t.Fatalf("Thai reader got %q", got)
	}
	if got := LocalizedClaim(c, i18n.English).AwardName; got != "Free Coffee" {
		t.Fatalf("English reader got %q", got)
	}
}

// Claims issued before the award had a Thai name keep the English one, for
// everyone. That prize genuinely had no Thai name when it was won, and saying
// so is more honest than backfilling today's translation onto yesterday's win.
func TestLocalizedClaimFallsBackForAPreTranslationWin(t *testing.T) {
	c := domain.Claim{AwardName: "Free Coffee"}
	if got := LocalizedClaim(c, i18n.Thai).AwardName; got != "Free Coffee" {
		t.Fatalf("got %q, want the English snapshot", got)
	}
}

// The showcase is where a player meets the prize list, so the pick has to
// survive the narrowing to PublicAward — the step that drops every other field.
func TestShowcaseServesThaiPrizeNames(t *testing.T) {
	awards := []domain.Award{
		{
			Name: "Free Coffee", NameTH: "กาแฟฟรี",
			Description: "Reach 40 taps.", DescriptionTH: "แตะให้ได้ 40 ครั้ง",
			GameSlug: "tap-fast", MinScore: 40, Stock: domain.Unlimited, Active: true,
		},
	}

	th := Showcase(awards, "tap-fast", domain.HigherIsBetter, i18n.Thai)
	if len(th) != 1 || th[0].Name != "กาแฟฟรี" || th[0].Description != "แตะให้ได้ 40 ครั้ง" {
		t.Fatalf("Thai showcase = %+v", th)
	}

	en := Showcase(awards, "tap-fast", domain.HigherIsBetter, i18n.English)
	if len(en) != 1 || en[0].Name != "Free Coffee" {
		t.Fatalf("English showcase = %+v", en)
	}
}

// Equal thresholds tie-break by name, and after this change that is the
// RESOLVED name. A Thai list ordered by the English original would have no
// visible logic to the person reading it.
func TestShowcaseTieBreaksOnTheResolvedName(t *testing.T) {
	awards := []domain.Award{
		{Name: "Zebra", NameTH: "ก", GameSlug: "tap-fast", MinScore: 10, Stock: domain.Unlimited, Active: true},
		{Name: "Apple", NameTH: "ข", GameSlug: "tap-fast", MinScore: 10, Stock: domain.Unlimited, Active: true},
	}

	// English orders Apple before Zebra.
	if got := names(Showcase(awards, "tap-fast", domain.HigherIsBetter, i18n.English)); got[0] != "Apple" {
		t.Fatalf("English order = %v", got)
	}
	// Thai orders ก before ข — the opposite pair, which is the point.
	if got := names(Showcase(awards, "tap-fast", domain.HigherIsBetter, i18n.Thai)); got[0] != "ก" {
		t.Fatalf("Thai order = %v", got)
	}
}
