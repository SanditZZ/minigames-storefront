package reward

import (
	"sort"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
	"github.com/sanditzz/minigames-storefront/backend/internal/i18n"
)

// PublicAward is the player-facing view of a prize, shown on the landing screen
// so a customer knows what is on offer BEFORE they play.
//
// It is deliberately a narrower type than domain.Award rather than the award
// itself: remaining stock, sort order and timestamps are operational data that
// no player needs and that an unauthenticated endpoint should not hand out.
// Scarcity is conveyed as a boolean instead — "Sold out" is the only part of a
// stock level a customer can act on.
type PublicAward struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	ImageURL    string `json:"imageUrl"`
	// MinScore is the threshold to win, in the game's ScoreUnit.
	MinScore int  `json:"minScore"`
	SoldOut  bool `json:"soldOut"`
}

// Showcase lists the prizes on offer for one game, easiest first.
//
// "Easiest first" follows the game's direction — the lowest threshold for a
// higher-is-better game, the most generous (largest) time for a lower-is-better
// one — so the ladder reads as a climb in both cases. Sold-out prizes are kept
// and flagged rather than hidden: an empty-looking board is worse than an
// honest one, and a prize that ran out today is back tomorrow.
//
// The prizes arrive already worded for loc — see text.go for why the pick lives
// here rather than at the transport edge, and why it falls back per field. Note
// the sort's name tie-break therefore orders by the RESOLVED name, which is
// what a reader of that language is actually looking at; ordering by the
// English name would put a Thai list in an order with no visible logic.
//
// Pure: same inputs, same output, no I/O.
func Showcase(awards []domain.Award, slug domain.GameSlug, dir domain.ScoreDirection, loc i18n.Locale) []PublicAward {
	out := make([]PublicAward, 0, len(awards))
	for _, a := range awards {
		if !a.Active || !appliesToGame(a, slug) {
			continue
		}
		a = LocalizedAward(a, loc)
		out = append(out, PublicAward{
			Name:        a.Name,
			Description: a.Description,
			ImageURL:    a.ImageURL,
			MinScore:    a.MinScore,
			SoldOut:     !hasStock(a),
		})
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].MinScore != out[j].MinScore {
			if dir == domain.LowerIsBetter {
				return out[i].MinScore > out[j].MinScore // a looser time is easier
			}
			return out[i].MinScore < out[j].MinScore
		}
		return out[i].Name < out[j].Name
	})
	return out
}
