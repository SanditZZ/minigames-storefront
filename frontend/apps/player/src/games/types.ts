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
  /** Called once with the final raw score when the round ends. */
  onFinish: (value: number) => void;
}

/** A registered playable game: its backend slug and its React play component. */
export interface MiniGame {
  slug: string;
  Play: ComponentType<PlayProps>;
}
