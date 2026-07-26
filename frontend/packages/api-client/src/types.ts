// These types mirror the Go backend's domain JSON exactly. They are the single
// shared contract both frontends import, so a backend field change surfaces as
// a TypeScript error rather than a runtime surprise.

export type ScoreDirection = "higher" | "lower";
/**
 * How a Setting.value should be interpreted. Mirrors domain.SettingType.
 *
 * "color" is a hex literal and its own type rather than a string because the
 * value is written into a live CSS custom property: the backend validates it at
 * write time (internal/settings.IsHexColor) so nothing downstream has to
 * sanitise, and the admin renders a colour picker instead of a text box.
 */
export type SettingType = "string" | "int" | "bool" | "color";

/** Sentinel Award.stock value meaning the prize never runs out. */
export const UNLIMITED_STOCK = -1;

export interface Game {
  slug: string;
  name: string;
  description: string;
  scoreUnit: string;
  direction: ScoreDirection;
  durationMs: number;
  /**
   * The house benchmark the reveal meter reads full at. 0 means unset, and the
   * client falls back to the leaderboard leader — see benchmarkFor in
   * @minigames/player-core for why that fallback is a last resort rather than
   * the design.
   */
  targetScore: number;
  enabled: boolean;
}

export interface ScoreEntry {
  id: string;
  gameSlug: string;
  playerName: string;
  value: number;
  /** Prize won at play time; absent when the round won nothing. */
  awardId?: string;
  createdAt: string;
}

export interface Award {
  id: string;
  name: string;
  description: string;
  /**
   * The operator's Thai text. "" means NOT TRANSLATED rather than "blank", and
   * the server falls back PER FIELD — a prize with a Thai name and no Thai
   * description is served with the Thai name and the English description.
   *
   * Only the ADMIN ever sees these. A player's endpoints resolve the pick
   * server-side and serve `name`/`description` ready to render, so no client
   * re-derives the rule. See internal/reward/text.go.
   */
  nameTh: string;
  descriptionTh: string;
  imageUrl: string;
  gameSlug: string; // "" = applies to any game
  minScore: number;
  stock: number; // -1 = unlimited
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** The admin-editable fields of an Award (server manages id/timestamps). */
export type AwardInput = Pick<
  Award,
  | "name"
  | "description"
  | "nameTh"
  | "descriptionTh"
  | "imageUrl"
  | "gameSlug"
  | "minScore"
  | "stock"
  | "active"
  | "sortOrder"
>;

export interface Setting {
  key: string;
  value: string;
  type: SettingType;
  description: string;
  updatedAt: string;
}

export type SettingInput = Pick<Setting, "value" | "type" | "description">;

/**
 * The settings an unauthenticated client may read, as served by
 * GET /api/v1/settings/public.
 *
 * A bare string map by design — the backend's allowlist (internal/settings)
 * decides which keys appear, and typing it as a closed shape here would only
 * duplicate that decision at the wrong end of the wire. A key being absent is
 * normal, not an error: it means the operator never set it, and the client
 * falls back (see storeIdentity in @minigames/player-core).
 */
export type PublicSettings = Record<string, string>;

/**
 * A stored image, as returned by the upload endpoint.
 *
 * `url` is absolute and is what gets saved onto an award or the logo setting.
 * `name` is the server-minted object name — the client's filename is discarded
 * on upload — and is only needed to delete the object later.
 */
export interface UploadedImage {
  url: string;
  name: string;
}

export interface StartSessionResponse {
  token: string;
  gameSlug: string;
  durationMs: number;
  expiresAt: string;
}

export interface SubmitScoreInput {
  token: string;
  playerName: string;
  value: number;
}

/**
 * The redeemable credential a winning round earns.
 *
 * `awardName` is a SNAPSHOT taken when the claim was issued, not a lookup — an
 * award deleted afterwards must not rewrite what a permanent result URL says
 * was won. Read the prize name from here, never by re-resolving `awardId`.
 *
 * `expiresAt` is absent when claims never expire (the admin set the TTL to 0).
 */
export interface Claim {
  id: string;
  code: string;
  scoreId: string;
  awardId: string;
  /**
   * The prize's name, SNAPSHOTTED when the claim was issued so a later rename
   * or delete cannot rewrite what a permanent result URL says was won.
   *
   * The player's endpoints resolve it to the reader's language; the admin's
   * serve it as stored, because the counter is operator-facing and deliberately
   * untranslated. Both are `awardName` on the wire — which of the two arrived
   * depends on which endpoint answered.
   */
  awardName: string;
  issuedAt: string;
  expiresAt?: string;
  redeemedAt?: string;
}

export type ClaimStatus = "issued" | "redeemed" | "expired";

/**
 * A claim plus its status at the moment the server read it.
 *
 * The status is DERIVED from (redeemedAt, expiresAt, now) and arrives already
 * computed — do not re-derive it here. Deriving needs a clock, and the only
 * clock available to this code is the device's, which the player controls. A
 * phone with its date wound back would otherwise show an expired prize as
 * claimable.
 */
export interface ClaimView {
  claim: Claim;
  status: ClaimStatus;
}

export interface SubmitResult {
  score: ScoreEntry;
  rank: number;
  award?: Award;
  /** Absent when the round won nothing, or when issuing the claim failed. */
  claim?: ClaimView;
}

/**
 * A prize as shown to a player BEFORE they play — the trimmed, public view the
 * backend serves from GET /games/{slug}/awards. Deliberately narrower than
 * Award: remaining stock never leaves the server, so scarcity arrives as a
 * boolean instead.
 */
export interface Prize {
  name: string;
  description: string;
  imageUrl: string;
  /** Threshold to win, in the game's scoreUnit. */
  minScore: number;
  soldOut: boolean;
}

export interface HighScores {
  game: Game;
  scores: ScoreEntry[];
}
