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
type Game struct {
	Slug        GameSlug       `json:"slug"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	ScoreUnit   string         `json:"scoreUnit"`   // e.g. "taps", "ms"
	Direction   ScoreDirection `json:"direction"`   // higher- or lower-is-better
	DurationMs  int            `json:"durationMs"`  // suggested round length
	Enabled     bool           `json:"enabled"`
}

// Session is a server-issued, single-use permit to submit one score for one
// game. It exists so the backend — not the client — is the source of truth for
// when a round started and whether a submission has already been consumed.
type Session struct {
	Token      string    `json:"token"`
	GameSlug   GameSlug  `json:"gameSlug"`
	IssuedAt   time.Time `json:"issuedAt"`
	ExpiresAt  time.Time `json:"expiresAt"`
	ConsumedAt *time.Time `json:"consumedAt,omitempty"`
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
	Value      int       `json:"value"` // raw score in the game's ScoreUnit
	AwardID    string    `json:"awardId,omitempty"` // "" = no prize won
	CreatedAt  time.Time `json:"createdAt"`
}

// Award is a configurable prize a player can win. MinScore is the threshold in
// the target game's ScoreUnit that a player must reach (respecting the game's
// ScoreDirection) to qualify. GameSlug empty means the award applies to any game.
type Award struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	ImageURL    string    `json:"imageUrl"`
	GameSlug    GameSlug  `json:"gameSlug"`   // "" = any game
	MinScore    int       `json:"minScore"`   // threshold to qualify
	Stock       int       `json:"stock"`      // remaining units; -1 = unlimited
	Active      bool      `json:"active"`
	SortOrder   int       `json:"sortOrder"`  // tie-break / display ordering
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// Unlimited is the sentinel Stock value meaning "never runs out".
const Unlimited = -1

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
)

// Well-known setting keys. Centralized so calculations and actions never
// hard-code loose strings.
const (
	SettingSessionTTLSeconds = "session_ttl_seconds"
	SettingMaxTapsPerSecond  = "max_taps_per_second"
	SettingHighScoreLimit    = "high_score_limit"
	SettingAllowReplays      = "allow_replays"
)
