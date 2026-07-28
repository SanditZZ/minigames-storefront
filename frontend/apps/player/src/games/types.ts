import type { IconName } from "@minigames/icons";
import type { ComponentType } from "react";

/**
 * What a game hands back when its round ends.
 *
 * A NUMBER is a score the game worked out for itself — the original contract,
 * and still the right one for a game whose rules the server cannot replay.
 *
 * An ARRAY is the moments the player acted, in ms from the start of play. The
 * game reports what was DONE and declines to say what it was worth; the server
 * replays the events and computes the score. Stack is the first game to do
 * this, and its component never counts its own blocks.
 *
 * A union rather than two callbacks, so a game cannot report both and no
 * existing game had to change to gain the option.
 */
export type RoundReport = number | number[];

/**
 * Props every mini-game receives. The host (RoundRunner) owns the session and
 * scoring plumbing; a game only has to run its interaction and report the round
 * via onFinish. This is the contract that keeps "add a game" down to writing
 * one component.
 */
export interface PlayProps {
  /** Round length in ms, from the game's catalog config. */
  durationMs: number;
  /**
   * The server's description of this round, for a game the server scores.
   *
   * `unknown` because its shape belongs to the individual game: the component
   * hands it to a pure parser in `@minigames/player-core`, which validates it
   * and falls back to the built-in constants when it is absent or malformed.
   * Undefined for every game that scores itself.
   */
  challenge?: unknown;
  /**
   * What the score is counted in ("taps", "ครั้ง"), already in the player's
   * language — the backend serves it with the game (see internal/i18n).
   *
   * Passed in rather than hardcoded by the game that displays it: a live tap
   * counter and the result screen's big number are the same quantity, and they
   * were free to disagree while one of them spelled the unit itself.
   */
  scoreUnit: string;
  /** Called exactly once when the round ends. See RoundReport. */
  onFinish: (report: RoundReport) => void;
}

/** A registered playable game: its backend slug, identity, and play component. */
export interface MiniGame {
  slug: string;
  /**
   * The icon that stands for this game in the picker, named from
   * `@minigames/icons`.
   *
   * Typed as `IconName` rather than `string` on purpose: this field is how the
   * emoji debt used to grow — every new game added one more glyph, so the
   * clean-up got longer than it started. A name that is not in the table now
   * fails `npm run typecheck`, which means a new game cannot reintroduce one.
   *
   * Identity here is an ICON only — deliberately not a colour. Every game
   * inherits the one shared palette (see frontend/CLAUDE.md), so per-game
   * theming is not a knob this interface offers.
   */
  icon: IconName;
  Play: ComponentType<PlayProps>;
}
