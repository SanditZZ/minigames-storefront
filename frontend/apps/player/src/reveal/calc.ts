// CALCULATIONS layer: the maths behind the score reveal. Pure functions only —
// no timers, no DOM, no React. The animation hook feeds them a progress value
// and renders whatever comes back, which keeps every rule here testable.

import { TIERS, type Tier } from "./tiers";

/** Score direction, mirrored from the API contract. */
export type Direction = "higher" | "lower";

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * How far up the tower this score reaches, as a 0–1 fraction of the house best.
 *
 * The reference point is the leaderboard leader, so the meter answers "how close
 * am I to the best anyone has done here?" — the same question the arcade machine
 * asks. With no leaderboard yet (or a nonsensical best) the player IS the best,
 * so the tower fills.
 */
export function meterFraction(value: number, best: number | null, direction: Direction): number {
  if (best === null || !Number.isFinite(best) || best <= 0) return 1;

  if (direction === "lower") {
    // Lower is better: the best (smallest) time over yours. A zero/negative
    // time is not physically meaningful, so treat it as a full tower.
    if (value <= 0) return 1;
    return clamp01(best / value);
  }
  return clamp01(value / best);
}

/** Standard decelerating ease, used for the honest count-up of the number. */
export function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

/**
 * A damped spring: shoots past the target, then oscillates into place — the
 * puck slamming up the tower and bouncing at the top.
 *
 * f(0) = 0 exactly, and the exponential decay leaves f(1) ≈ 1, so the meter
 * lands on its target without a visible snap.
 */
export function springSettle(t: number): number {
  const x = clamp01(t);
  return 1 - Math.exp(-6 * x) * Math.cos(3 * Math.PI * x);
}

/**
 * Height of the puck at progress `t`, as a 0–1 fraction of the tower. The
 * overshoot is clipped at the top of the tower rather than allowed to fly off it.
 */
export function meterHeight(targetFraction: number, t: number): number {
  return clamp01(springSettle(t) * clamp01(targetFraction));
}

/**
 * The number shown at progress `t`.
 *
 * Deliberately monotonic and capped at the real score: the puck may bounce past
 * its mark, but the digits must only ever climb to the true value. A number that
 * overshoots and ticks back down reads as a glitch — or worse, as the game
 * taking points away.
 */
export function countUpValue(target: number, t: number): number {
  return Math.round(target * easeOutCubic(t));
}

/** The tier a fraction of the tower falls into. Never returns undefined. */
export function tierFor(fraction: number, tiers: Tier[] = TIERS): Tier {
  const f = clamp01(fraction);
  let current = tiers[0];
  for (const tier of tiers) {
    if (f >= tier.from) current = tier;
  }
  return current;
}

/**
 * The best score on the board, or null when there is nothing to compare against.
 * Ordering is the backend's job, so this only reads the first entry.
 */
export function bestScore(scores: { value: number }[] | null): number | null {
  if (!scores || scores.length === 0) return null;
  return scores[0].value;
}

/** True when this round tops the board — the bell-ringing case. */
export function isNewRecord(rank: number): boolean {
  return rank === 1;
}
