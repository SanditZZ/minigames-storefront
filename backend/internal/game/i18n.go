package game

import (
	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
	"github.com/sanditzz/minigames-storefront/backend/internal/i18n"
)

// Text is the player-visible wording of one catalog entry.
//
// The score unit is in here with the name and description because it is prose
// too, not a symbol: it is printed under the big number on the reveal and beside
// every row of the leaderboard, so "taps" has to become "ครั้ง" for the same
// reason "Tap Fast" has to become "แตะให้ไว". It is deliberately SHORT in every
// locale — see the note on the Thai table below.
type Text struct {
	Name        string
	Description string
	ScoreUnit   string
}

// translations is the catalog's wording, keyed locale → slug → text.
//
// English is not in here: it lives on the domain.Game literals in catalog.go,
// which stay the reference text. That asymmetry is deliberate — a game's
// definition should read as a whole in one place, and duplicating its English
// name into a translation table would create two spellings of the thing that
// has to match the client registry's slug-keyed expectations.
//
// Thai score units are kept short on purpose. They render inside a fixed slot
// (Stat's label, ScoreRow's value column), and Thai does not put spaces between
// words, so `truncate` cuts mid-word rather than at a boundary — a long unit
// does not gracefully shorten, it becomes gibberish. Test any new one at 320px.
var translations = map[i18n.Locale]map[domain.GameSlug]Text{
	i18n.Thai: {
		SlugTapFast: {
			Name:        "แตะให้ไว",
			Description: "แตะปุ่มให้ได้มากที่สุดก่อนหมดเวลา!",
			ScoreUnit:   "ครั้ง",
		},
		SlugReactionTimer: {
			Name:        "วัดปฏิกิริยา",
			Description: "รอให้ปุ่มสว่างขึ้น แล้วแตะให้เร็วที่สุด ใครเร็วกว่าชนะ!",
			ScoreUnit:   "มิลลิวินาที",
		},
		SlugPrecisionStop: {
			Name:        "หยุดให้ตรงกลาง",
			Description: "หยุดตัววิ่งให้ตรงกลางที่สุด ยิ่งใกล้คะแนนยิ่งน้อย — และน้อยที่สุดคือผู้ชนะ!",
			ScoreUnit:   "ห่างกึ่งกลาง",
		},
	},
}

// Localize returns g with its player-visible wording swapped for the requested
// locale. Everything else — slug, direction, durations, the tuned benchmark —
// is untouched, because none of it is language.
//
// Pure: same game and locale in, same game out. Falls back field by field, so a
// half-written translation shows the translated name next to the English
// description rather than reverting the whole entry; a partly-done locale is
// then obvious on screen instead of silently absent.
//
// This runs at the TRANSPORT edge (see httpapi), not in the app service: the
// service decides which games exist and what their benchmark is, and neither of
// those depends on who is reading. Localizing earlier would put a presentation
// concern inside the layer that owns the rules.
func Localize(g domain.Game, loc i18n.Locale) domain.Game {
	text, ok := translations[loc][g.Slug]
	if !ok {
		return g
	}
	if text.Name != "" {
		g.Name = text.Name
	}
	if text.Description != "" {
		g.Description = text.Description
	}
	if text.ScoreUnit != "" {
		g.ScoreUnit = text.ScoreUnit
	}
	return g
}

// LocalizeAll maps Localize over a catalog, returning a new slice so the
// registry's own definitions can never be rewritten by a request.
func LocalizeAll(games []domain.Game, loc i18n.Locale) []domain.Game {
	out := make([]domain.Game, len(games))
	for i, g := range games {
		out[i] = Localize(g, loc)
	}
	return out
}

// TranslatedSlugs returns the slugs a locale has wording for. Exported for the
// catalog test, which asserts every registered game is covered by every
// non-English locale — a game added without its Thai text is a hole a player
// sees, so it fails the build rather than the storefront.
func TranslatedSlugs(loc i18n.Locale) []domain.GameSlug {
	table := translations[loc]
	out := make([]domain.GameSlug, 0, len(table))
	for slug := range table {
		out = append(out, slug)
	}
	return out
}
