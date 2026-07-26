package game

import (
	"testing"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
	"github.com/sanditzz/minigames-storefront/backend/internal/i18n"
)

// The one that actually protects a storefront: a game added to the registry
// without its Thai wording would show an English name and an English score unit
// on an otherwise Thai screen, and nothing else would notice.
func TestEveryGameIsTranslatedInEveryLocale(t *testing.T) {
	registry := DefaultRegistry()
	for _, loc := range i18n.Supported {
		if loc == i18n.English {
			continue // English lives on the catalog literals themselves
		}
		for _, g := range registry.Games() {
			text, ok := translations[loc][g.Slug]
			if !ok {
				t.Errorf("locale %q has no wording for game %q", loc, g.Slug)
				continue
			}
			if text.Name == "" || text.Description == "" || text.ScoreUnit == "" {
				t.Errorf("locale %q has an incomplete entry for %q: %+v", loc, g.Slug, text)
			}
		}
	}
}

// The reverse: wording for a game that no longer exists is dead weight that
// reads as coverage.
func TestNoTranslationsForUnknownGames(t *testing.T) {
	registry := DefaultRegistry()
	for _, loc := range i18n.Supported {
		for _, slug := range TranslatedSlugs(loc) {
			if _, ok := registry.Get(slug); !ok {
				t.Errorf("locale %q carries wording for unregistered game %q", loc, slug)
			}
		}
	}
}

func TestLocalize(t *testing.T) {
	tapFast := TapFast.Game

	thai := Localize(tapFast, i18n.Thai)
	if thai.Name == tapFast.Name || thai.Description == tapFast.Description || thai.ScoreUnit == tapFast.ScoreUnit {
		t.Errorf("Thai localization changed nothing: %+v", thai)
	}

	// Everything that is not language must survive untouched — a translated
	// game is still the same game, worth the same score, timed the same way.
	if thai.Slug != tapFast.Slug || thai.Direction != tapFast.Direction ||
		thai.DurationMs != tapFast.DurationMs || thai.TargetScore != tapFast.TargetScore ||
		thai.Enabled != tapFast.Enabled {
		t.Errorf("Localize altered non-language fields: %+v", thai)
	}
}

func TestLocalizeLeavesUnknownLocalesAlone(t *testing.T) {
	tapFast := TapFast.Game
	for _, loc := range []i18n.Locale{i18n.English, i18n.Locale("de")} {
		if got := Localize(tapFast, loc); got != tapFast {
			t.Errorf("Localize(%q) should be a no-op, got %+v", loc, got)
		}
	}
}

// A slug with no entry passes through rather than blanking, so an unfinished
// translation costs one game its Thai name instead of costing it its name.
func TestLocalizeFallsBackForAnUntranslatedGame(t *testing.T) {
	stranger := domain.Game{Slug: "not-in-the-table", Name: "Stranger", ScoreUnit: "points"}
	if got := Localize(stranger, i18n.Thai); got != stranger {
		t.Errorf("an untranslated game should pass through, got %+v", got)
	}
}

// The catalog is registry data read concurrently and never mutated, so a
// request answered in Thai must not rewrite what the next English one sees.
func TestLocalizeAllDoesNotMutateTheRegistry(t *testing.T) {
	registry := DefaultRegistry()
	before := registry.Games()

	LocalizeAll(before, i18n.Thai)

	for i, g := range registry.Games() {
		if g != before[i] {
			t.Errorf("LocalizeAll mutated the catalog: %+v", g)
		}
	}
	if registry.Games()[0].Name != "Tap Fast" {
		t.Errorf("catalog name was rewritten to %q", registry.Games()[0].Name)
	}
}
