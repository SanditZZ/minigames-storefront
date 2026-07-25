// These types mirror the Go backend's domain JSON exactly. They are the single
// shared contract both frontends import, so a backend field change surfaces as
// a TypeScript error rather than a runtime surprise.

export type ScoreDirection = "higher" | "lower";
export type SettingType = "string" | "int" | "bool";

/** Sentinel Award.stock value meaning the prize never runs out. */
export const UNLIMITED_STOCK = -1;

export interface Game {
  slug: string;
  name: string;
  description: string;
  scoreUnit: string;
  direction: ScoreDirection;
  durationMs: number;
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
  "name" | "description" | "imageUrl" | "gameSlug" | "minScore" | "stock" | "active" | "sortOrder"
>;

export interface Setting {
  key: string;
  value: string;
  type: SettingType;
  description: string;
  updatedAt: string;
}

export type SettingInput = Pick<Setting, "value" | "type" | "description">;

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
