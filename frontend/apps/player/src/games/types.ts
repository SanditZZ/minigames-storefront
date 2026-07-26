import type { ComponentType } from "react";

/**
 * Props every mini-game receives. The host (RoundRunner) owns the session and
 * scoring plumbing; a game only has to run its interaction and report a final
 * numeric score via onFinish. This is the contract that keeps "add a game"
 * down to writing one component.
 */
export interface PlayProps {
  /** Round length in ms, from the game's catalog config. */
  durationMs: number;
  /**
   * What the score is counted in ("taps", "ครั้ง"), already in the player's
   * language — the backend serves it with the game (see internal/i18n).
   *
   * Passed in rather than hardcoded by the game that displays it: a live tap
   * counter and the result screen's big number are the same quantity, and they
   * were free to disagree while one of them spelled the unit itself.
   */
  scoreUnit: string;
  /** Called once with the final raw score when the round ends. */
  onFinish: (value: number) => void;
}

/** A registered playable game: its backend slug, identity, and play component. */
export interface MiniGame {
  slug: string;
  /**
   * The emoji that stands for this game in the picker.
   *
   * Identity here is an ICON only — deliberately not a colour. Every game
   * inherits the one shared palette (see frontend/CLAUDE.md), so per-game
   * theming is not a knob this interface offers.
   */
  icon: string;
  Play: ComponentType<PlayProps>;
}
