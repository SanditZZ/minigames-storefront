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
 * The scale the tower is drawn against: the game's fixed benchmark if it has
 * one, otherwise the leaderboard leader, otherwise nothing.
 *
 * The order is the whole point. A benchmark painted on the machine is honest —
 * it answers "how close am I to a good round?" and gives the same answer to
 * everyone. The leaderboard leader is the board scaling against itself, and it
 * fails in two directions:
 *
 *  - An empty board makes the first player their own denominator, so every
 *    opening round reads "Record breaker".
 *  - On a lower-is-better game whose scores can legitimately reach 0 — Precision
 *    Stop, where 0 is the GOAL rather than an impossibility — one perfect round
 *    sets `best` to 0 for every later player on that board. Nothing divides by
 *    a perfect score, so the meter would fill for everyone, permanently, and
 *    silently. That is what the fallback below returning null protects.
 *
 * A non-positive value from either source is treated as absent rather than
 * clamped, because there is no honest way to scale against "perfect".
 */
export function benchmarkFor(
  targetScore: number | null | undefined,
  boardBest: number | null,
): number | null {
  if (typeof targetScore === "number" && Number.isFinite(targetScore) && targetScore > 0) {
    return targetScore;
  }
  if (boardBest !== null && Number.isFinite(boardBest) && boardBest > 0) return boardBest;
  return null;
}

/**
 * How far up the tower this score reaches, as a 0–1 fraction of the benchmark.
 *
 * With no benchmark at all the tower fills: there is nothing to measure
 * against, so the player is their own scale. That branch is not meant to be
 * reached — every game in the catalog declares a targetScore, and a Go test
 * (game.TestEveryGameDeclaresATargetScore) fails the build if one does not.
 * It survives as the answer to "what if a client meets an older server", not
 * as the normal path it used to be.
 */
export function meterFraction(value: number, benchmark: number | null, direction: Direction): number {
  if (benchmark === null || !Number.isFinite(benchmark) || benchmark <= 0) return 1;

  if (direction === "lower") {
    // Lower is better: the benchmark over your score. Reaching or beating it
    // fills the tower, which is what makes a perfect 0 the best round rather
    // than a divide-by-zero.
    if (value <= 0) return 1;
    return clamp01(benchmark / value);
  }
  return clamp01(value / benchmark);
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
 *
 * This is the meter's FALLBACK scale, not its scale — pass it through
 * benchmarkFor, which prefers the game's own targetScore.
 */
export function bestScore(scores: { value: number }[] | null): number | null {
  if (!scores || scores.length === 0) return null;
  return scores[0].value;
}

/** True when this round tops the board — the bell-ringing case. */
export function isNewRecord(rank: number): boolean {
  return rank === 1;
}
