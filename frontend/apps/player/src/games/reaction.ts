// CALCULATIONS layer for the Reaction Timer game. Pure functions only — no
// timers, no DOM, no React. The component feeds these the numbers it has and
// renders whatever comes back, which keeps every rule here testable.

/** How long the "wait for it" phase can last, in ms. */
export const MIN_WAIT_MS = 1500;
export const MAX_WAIT_MS = 4000;

/**
 * Picks the delay before the screen flips, from a 0–1 random draw.
 *
 * Randomness is passed IN rather than drawn here so the function stays pure and
 * the bounds are testable. The window matters: shorter than ~1.5s and a player
 * can beat it by tapping on reflex the moment the round starts; longer than ~4s
 * and attention wanders, which measures patience instead of reaction.
 */
export function waitDelayMs(draw: number): number {
  // NaN has to be caught before the clamp: Math.min/max propagate it, and a NaN
  // delay makes setTimeout fire on the next tick — an instant flip, which is a
  // free win rather than a reaction test.
  const safe = Number.isFinite(draw) ? draw : 0;
  const clamped = Math.max(0, Math.min(1, safe));
  return Math.round(MIN_WAIT_MS + clamped * (MAX_WAIT_MS - MIN_WAIT_MS));
}

/**
 * The score for a reaction, clamped to the game's ceiling.
 *
 * The ceiling is both the worst possible result and the score recorded when a
 * player never reacts at all, so "asleep" and "took far too long" land on the
 * same honest number instead of an unbounded one the server would reject.
 */
export function reactionScore(elapsedMs: number, ceilingMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return ceilingMs;
  return Math.min(Math.round(elapsedMs), ceilingMs);
}

/**
 * Whether a tap at this moment is a false start.
 *
 * A tap before the flip is jumping the gun. It does NOT end the round: the wait
 * is simply re-drawn, which is both fairer and unexploitable — a player who
 * spams taps keeps resetting the timer and never sees the flip at all, so
 * there is no advantage to chase.
 */
export function isFalseStart(flipped: boolean): boolean {
  return !flipped;
}

/** Rating shown beside a finished reaction, for immediate feedback. */
export function reactionVerdict(ms: number): string {
  if (ms < 200) return "Lightning";
  if (ms < 260) return "Sharp";
  if (ms < 350) return "Solid";
  if (ms < 500) return "Steady";
  return "Sleepy";
}
