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

export interface SubmitResult {
  score: ScoreEntry;
  rank: number;
  award?: Award;
}

export interface HighScores {
  game: Game;
  scores: ScoreEntry[];
}
