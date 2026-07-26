package reward

import (
	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
	"github.com/sanditzz/minigames-storefront/backend/internal/i18n"
)

// CALCULATIONS: picking which of an award's stored texts a reader should see.
//
// # Why this is not a message table
//
// Everything else the server translates is OURS to word — game names, score
// units, the errors a player reads after a failed round — so it lives in a
// table keyed by locale (internal/i18n, internal/game/i18n.go) and a missing
// entry fails a test. An award's name is admin-entered free text. No table can
// hold "Free Coffee" because nobody on this side of the wire wrote it, which is
// why the translation is a COLUMN and why "" means "the operator has not
// supplied one" rather than "this string is missing and someone should fix it".
//
// # Where it runs
//
// game.Localize runs at the transport edge, deliberately, because the catalog
// is static in-code data and the locale only decides which overlay to apply.
// This one runs inside Showcase instead, and the difference is not an
// inconsistency: the text is on the row, and narrowing domain.Award to
// PublicAward IS the presentation step. Splitting "which fields a player may
// see" from "which language they see them in" would mean carrying both
// languages through a type whose entire purpose is to carry less. The transport
// edge still owns NEGOTIATION (localeOf); it just hands the answer down.

// Text picks the reader's language for one field, falling back to English.
//
// The fallback is PER FIELD, which is the whole design and is worth stating
// where it is implemented rather than only where it is documented: an award
// with a Thai name and no Thai description shows the Thai name beside the
// English description. The alternative — dropping the pair back to English
// whenever either half is missing — hides work the operator has already done
// and makes a prize list something that has to be translated in one sitting.
//
// It is the same rule storeIdentity applies to the store's name and tagline, so
// "what happens when half a translation exists" has one answer in this system
// instead of two.
//
// A locale with no column of its own falls back to English by construction: it
// simply has nothing to pick. That is why this takes the value rather than a
// map — adding a locale means adding a column and a case here, and the compiler
// then finds every caller.
func Text(en, th string, loc i18n.Locale) string {
	if loc == i18n.Thai && th != "" {
		return th
	}
	return en
}

// LocalizedAward returns the award with Name and Description resolved for loc.
//
// It returns a COPY. The awards it is given come straight from the repository
// and are shared with whatever else is reading them in that request, so
// rewriting them in place would let one reader's language leak into another's —
// the same reason game.LocalizeAll builds a new slice.
//
// The Thai fields are left on the copy rather than blanked. Nothing serves
// domain.Award to a player (the admin API does, and the admin is untranslated
// by design), so blanking them would cost a surprise for no gain.
func LocalizedAward(a domain.Award, loc i18n.Locale) domain.Award {
	a.Name = Text(a.Name, a.NameTH, loc)
	a.Description = Text(a.Description, a.DescriptionTH, loc)
	return a
}

// LocalizedClaim resolves the prize name a claim SNAPSHOTTED, for one reader.
//
// It reads the claim's own copies and never the award, which is the point of
// the snapshot: a prize deleted or renamed after the fact must not change what
// a permanent result URL says was won (see 003_claims.sql). Translating by
// looking the award up again would reintroduce exactly the bug the snapshot
// exists to prevent, in a second language.
//
// A claim issued before its award had a Thai name falls back to the English
// one, which is honest rather than approximate: that prize genuinely had no
// Thai name at the moment it was won.
//
// Only the player's endpoints call this. The admin's claims panel is
// operator-facing and untranslated by design, so it serves AwardName as stored
// — which is also what makes storing both worth the column.
func LocalizedClaim(c domain.Claim, loc i18n.Locale) domain.Claim {
	c.AwardName = Text(c.AwardName, c.AwardNameTH, loc)
	return c
}
