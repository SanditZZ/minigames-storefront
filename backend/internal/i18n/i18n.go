// Package i18n is the language layer for everything the SERVER decides the
// wording of. It is DATA plus CALCULATIONS: locale constants, message tables,
// and pure lookup/negotiation functions. Nothing here touches HTTP, storage or
// the clock — the transport layer reads a locale off a request and passes it
// in.
//
// The split this package sits on one side of is worth stating, because it is
// the rule that decides where a new string goes (see docs/potential-features.md
// and frontend/CLAUDE.md):
//
//   - Anything the SERVER already decides carries its own translation. Game
//     names, descriptions and score units are catalog data; the errors below
//     are sentences a player reads verbatim after a failed round. Making the
//     client re-derive them would mean shipping the backend's vocabulary to
//     every client, twice, and letting the two drift.
//   - Anything that is CHROME — button labels, screen headings, the reveal's
//     tier ladder — stays in the client's own dictionary
//     (packages/player-core/src/i18n). Round-tripping a button label through
//     HTTP would make every screen wait on the network for its own furniture.
//
// Award names and descriptions are the third case, and they are why this is a
// split rather than a binary: they are admin-entered free text, so no table on
// either side of the wire can hold them. They are translated by COLUMN —
// awards.name_th, claims.award_name_th — and resolved by internal/reward/text.go,
// where "" means "the operator supplied none" rather than "someone forgot to
// translate this". A missing entry here fails a test; a missing translation
// there is a supported configuration.
package i18n

// Locale is a language this API can answer in. It is a closed set on purpose:
// an unrecognised tag resolves to Default rather than becoming a new locale
// nobody wrote strings for.
type Locale string

const (
	// English is the fallback and the language every message is guaranteed to
	// have. A missing translation falls back here rather than to an empty
	// string, so a half-translated build reads oddly instead of blankly.
	English Locale = "en"

	// Thai is the first translated locale — a storefront in a Thai venue is
	// what this whole package exists for.
	Thai Locale = "th"
)

// Default is what an unspecified, unrecognised or malformed request gets.
const Default = English

// Supported is every locale the API will answer in, in the order they are
// offered. Adding one means adding its column to every table in messages.go
// and games.go — which the tests enforce, so a half-added locale fails the
// build rather than shipping English holes.
var Supported = []Locale{English, Thai}

// IsSupported reports whether a locale is one this API answers in.
func IsSupported(l Locale) bool {
	for _, s := range Supported {
		if s == l {
			return true
		}
	}
	return false
}
