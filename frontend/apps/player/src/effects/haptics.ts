// ACTIONS layer: physical feedback. Side effects only, no logic worth testing.
//
// Kept in one module so every game buzzes with the same vocabulary rather than
// each inventing its own durations, and so the whole feature can be disabled in
// one place later (a kiosk setting, or a player preference).

/** True when the device exposes the Vibration API at all (desktop does not). */
function canVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/**
 * Fires a vibration pattern, silently doing nothing where it is unsupported.
 *
 * Wrapped in a try/catch because some browsers throw rather than no-op when
 * vibration is blocked by a permissions policy — a buzz failing must never take
 * down the round that triggered it.
 */
function buzz(pattern: number | number[]): void {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* vibration is decoration; never let it break the game */
  }
}

/** A single tap registering. Deliberately tiny — this fires many times a second. */
export function tapPulse(): void {
  buzz(8);
}

/** The moment a reaction-timer screen flips to GO. */
export function goPulse(): void {
  buzz(20);
}

/** A mistake: a false start, or an invalid action. */
export function errorPulse(): void {
  buzz([30, 40, 30]);
}

/** The round ending. */
export function finishPulse(): void {
  buzz([12, 60, 24]);
}
