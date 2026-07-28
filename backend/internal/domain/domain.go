// Package domain is the DATA layer: types, constants, and enums only.
//
// ACD rule: no logic, no side effects, and no imports from the calculation
// (game, reward) or action (httpapi, storage) layers. Everything here is a
// plain value that other layers read and produce.
package domain

import "time"

// GameSlug is the stable, URL-safe identifier for a game (e.g. "tap-fast").
type GameSlug string

// ScoreDirection describes whether a bigger raw value is a better result.
// Tapping games are HigherIsBetter; reaction-time games are lower-is-better.
type ScoreDirection string

const (
	// HigherIsBetter — the maximum value wins (taps, points).
	HigherIsBetter ScoreDirection = "higher"
	// LowerIsBetter — the minimum value wins (reaction ms, timing error).
	LowerIsBetter ScoreDirection = "lower"
)

// Game is the catalog definition of a playable mini-game. It is reference data
// describing HOW a game is scored; it holds no per-play state.
//
// TargetScore is the house benchmark the score reveal scales its tower against:
// the value at which the meter reads full. It exists because the alternative —
// scaling against the current leaderboard leader — makes the board its own
// denominator, so an empty board tells every player they broke the record, and
// on a lower-is-better game whose scores can legitimately reach 0 it fills the
// tower for everyone forever once anyone plays perfectly. A fixed benchmark is
// also what a real strength tester has: a painted scale, not one that moves
// with the last customer. Zero means unset and the client falls back to the
// leader; game.TestEveryGameDeclaresATargetScore keeps that fallback unreached.
type Game struct {
	Slug        GameSlug       `json:"slug"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	ScoreUnit   string         `json:"scoreUnit"`   // e.g. "taps", "ms"
	Direction   ScoreDirection `json:"direction"`   // higher- or lower-is-better
	DurationMs  int            `json:"durationMs"`  // suggested round length
	TargetScore int            `json:"targetScore"` // benchmark for a full meter; 0 = unset
	Enabled     bool           `json:"enabled"`
}

// Session is a server-issued, single-use permit to submit one score for one
// game. It exists so the backend — not the client — is the source of truth for
// when a round started and whether a submission has already been consumed.
//
// Challenge is the round's description as JSON, exactly as it was handed to the
// client ("" for a game that needs none). It is STORED rather than regenerated
// because a challenge may contain randomness the score depends on: Precision
// Stop's marker phase is drawn per round, and a server that could not say which
// phase it issued could not recompute where the marker was when the player
// stopped it. Stack's challenge happens to be constant and would survive being
// regenerated; relying on that would make "the challenge is reproducible" a
// property every future game had to preserve, which is not a property worth
// depending on.
//
// Kept as raw JSON rather than a typed field: the shape belongs to the
// individual game, and this layer is the one place that must not know which
// game it is holding.
type Session struct {
	Token      string     `json:"token"`
	GameSlug   GameSlug   `json:"gameSlug"`
	IssuedAt   time.Time  `json:"issuedAt"`
	ExpiresAt  time.Time  `json:"expiresAt"`
	ConsumedAt *time.Time `json:"consumedAt,omitempty"`
	Challenge  string     `json:"challenge,omitempty"`
}

// ScoreEntry is a persisted result of one completed round.
//
// AwardID records which prize (if any) this round actually won at the moment it
// was played. Storing it — rather than re-deriving eligibility later — is what
// makes a result permanently addressable: replaying the same score URL shows the
// prize that was really granted, even after stock, thresholds, or the award
// itself have changed.
type ScoreEntry struct {
	ID         string    `json:"id"`
	GameSlug   GameSlug  `json:"gameSlug"`
	PlayerName string    `json:"playerName"`
	Value      int       `json:"value"`             // raw score in the game's ScoreUnit
	AwardID    string    `json:"awardId,omitempty"` // "" = no prize won
	CreatedAt  time.Time `json:"createdAt"`
}

// Award is a configurable prize a player can win. MinScore is the threshold in
// the target game's ScoreUnit that a player must reach (respecting the game's
// ScoreDirection) to qualify. GameSlug empty means the award applies to any game.
type Award struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	// NameTH and DescriptionTH are the operator's Thai text, and "" means NOT
	// TRANSLATED rather than "blank". The resolver picks per field
	// (reward.LocalizedAward), so an award with a Thai name and no Thai
	// description shows the Thai name beside the English description — the same
	// per-field fallback `storeIdentity` uses for the store's name and tagline.
	//
	// Only these two are translatable, and only into Thai. A `map[Locale]string`
	// would be the general shape and the wrong one today: it trades a column an
	// admin form can render for a blob nothing validates, to serve locales that
	// do not exist. i18n.Supported is the list to grow first.
	NameTH        string    `json:"nameTh"`
	DescriptionTH string    `json:"descriptionTh"`
	ImageURL      string    `json:"imageUrl"`
	GameSlug      GameSlug  `json:"gameSlug"` // "" = any game
	MinScore      int       `json:"minScore"` // threshold to qualify
	Stock         int       `json:"stock"`    // remaining units; -1 = unlimited
	Active        bool      `json:"active"`
	SortOrder     int       `json:"sortOrder"` // tie-break / display ordering
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// Unlimited is the sentinel Stock value meaning "never runs out".
const Unlimited = -1

// Claim is the redeemable credential a winning round earns: the thing a player
// presents at the counter and an admin marks used. It is deliberately its own
// entity rather than columns on ScoreEntry — a score is an immutable result,
// while a claim has a lifecycle (issued → redeemed, or issued → expired).
//
// AwardName is a SNAPSHOT taken when the claim was issued, not a lookup. An
// award deleted afterwards resolves to "no prize" for display purposes, which
// would otherwise rewrite history on a permanent result URL: a page that read
// "You won a Coffee" would start reading "no prize this time". Copying the name
// onto the claim keeps the win honest whatever happens to the award later.
//
// There is no Status field, by design. issued/redeemed/expired is a pure
// function of (RedeemedAt, ExpiresAt, now) — storing it as well would create a
// second source of truth that disagrees the moment a claim expires without
// anyone writing a row. See internal/claim.StatusAt.
type Claim struct {
	ID        string `json:"id"`
	Code      string `json:"code"`    // human-transcribed; see id.NewClaimCode
	ScoreID   string `json:"scoreId"` // the round that earned it
	AwardID   string `json:"awardId"`
	AwardName string `json:"awardName"` // snapshot, see above
	// AwardNameTH is the same snapshot in Thai, and "" means the prize had no
	// Thai name when this claim was issued. Both are stored because the two
	// readers want different ones: the player's result screen follows their
	// locale, while the admin's claims panel is operator-facing and untranslated.
	AwardNameTH string     `json:"awardNameTh"`
	IssuedAt    time.Time  `json:"issuedAt"`
	ExpiresAt   time.Time  `json:"expiresAt,omitempty"` // zero = never expires
	RedeemedAt  *time.Time `json:"redeemedAt,omitempty"`
}

// ClaimStatus is the derived state of a Claim at a point in time. It is never
// persisted; internal/claim.StatusAt computes it.
type ClaimStatus string

const (
	// ClaimIssued — outstanding and redeemable.
	ClaimIssued ClaimStatus = "issued"
	// ClaimRedeemed — handed over at the counter. Terminal.
	ClaimRedeemed ClaimStatus = "redeemed"
	// ClaimExpired — its window closed before anyone redeemed it.
	ClaimExpired ClaimStatus = "expired"
)

// Setting is a single admin-configurable key/value knob. Typed so the admin UI
// can render an appropriate control and the backend can parse safely.
type Setting struct {
	Key         string      `json:"key"`
	Value       string      `json:"value"`
	Type        SettingType `json:"type"`
	Description string      `json:"description"`
	UpdatedAt   time.Time   `json:"updatedAt"`
}

// SettingType constrains how a Setting.Value string should be interpreted.
type SettingType string

const (
	SettingString SettingType = "string"
	SettingInt    SettingType = "int"
	SettingBool   SettingType = "bool"
	// SettingColor is a hex colour literal (#abc or #aabbcc). It is its own
	// type rather than a string because these values are written into a live
	// CSS custom property on the player's document: a string type would accept
	// `url(...)` or `var(...)`, which are valid CSS and would reach the style
	// engine intact. Validating at write time is what keeps that impossible,
	// and it also tells the admin UI to render a colour picker.
	SettingColor SettingType = "color"
)

// Well-known setting keys. Centralized so calculations and actions never
// hard-code loose strings.
const (
	SettingSessionTTLSeconds = "session_ttl_seconds"
	SettingMaxTapsPerSecond  = "max_taps_per_second"
	SettingMinReactionMs     = "min_reaction_ms"
	SettingHighScoreLimit    = "high_score_limit"
	SettingAllowReplays      = "allow_replays"
	// SettingClaimTTLHours is how long an issued prize claim stays redeemable.
	// Admin-tunable because the right window is a venue policy, not a code
	// decision. Zero or negative means claims never expire (see claim.TTL).
	SettingClaimTTLHours = "claim_ttl_hours"

	// SettingStoreName and SettingStoreTagline are the storefront's identity as
	// players see it. They are the first settings a client may read WITHOUT the
	// admin token — see settings.IsPublic, which is the allowlist that decides
	// so, and which exists precisely so that adding a knob here does not
	// accidentally publish it.
	SettingStoreName    = "store_name"
	SettingStoreTagline = "store_tagline"
	// SettingStoreLogoURL is an absolute URL to the store's logo, shown in
	// place of the brand wordmark. It holds a URL rather than an object name
	// because an admin may equally paste one from their own CDN — the upload
	// endpoint is a convenience that produces such a URL, not the only source.
	SettingStoreLogoURL = "store_logo_url"
	// SettingStoreBannerURL is an absolute URL to the store's cover image,
	// spanning the top of the landing screen the way a social profile's cover
	// does. It is a SECOND image rather than a second use of the logo because
	// the two have different jobs and different shapes: the logo is a square
	// mark identifying the shop, the banner is wide photography setting its
	// tone. One image cannot be cropped to both without being wrong in one
	// place. Unset means the screen renders without one — never a placeholder.
	SettingStoreBannerURL = "store_banner_url"

	// The five brand colours, overriding the compiled-in design tokens. They
	// are public for the same reason the name is: the player's app renders
	// them. They are deliberately NOT seeded — absent means "use the tokens",
	// so a store that never opts out still follows a palette change in
	// packages/tokens. See override.ts for the full precedence rule.
	SettingColorBrand  = "color_brand"
	SettingColorBrand2 = "color_brand_2"
	SettingColorBrand3 = "color_brand_3"
	SettingColorBrand4 = "color_brand_4"
	SettingColorInk    = "color_ink"
)

// The storefront identity a fresh database is SEEDED with — placeholder prose
// an operator is expected to replace from the branding form.
//
// These deliberately DIFFER from the client's own fallback strings
// (`brand.name` / `brand.tagline` in frontend/packages/player-core/src/i18n),
// and that is load-bearing rather than incidental. The client falls back per
// field when the settings are absent or unreachable, so while the two sides
// spelled the same words no test could tell a name that arrived over HTTP from
// one compiled into the bundle: a StoreProvider that never fetched, or a screen
// that hard-coded the fallback, rendered "Fun Store" and passed. Keeping them
// distinct is what makes `result-url.spec.ts` — a result URL opened in a cold
// context, having never seen the landing screen — proof that the fetch happened.
//
// So: do not "tidy" these back into step with the dictionary. If the seed ever
// needs to change, change it to something the fallback still does not say.
const (
	DefaultStoreName    = "Sunny Mart"
	DefaultStoreTagline = "Every visit comes with a game — have a go!"
)

// DefaultClaimTTLHours is the fallback claim window: seven days, long enough
// that a player who wins on a Friday can still collect the next weekend.
const DefaultClaimTTLHours = 168
