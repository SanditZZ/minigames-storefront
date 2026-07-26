// CALCULATIONS layer for the Precision Stop game. Pure functions only — no
// rAF, no DOM, no React. The component runs the clock and paints; every rule
// about where the marker is and what a stop is worth lives here.

import type { MessageKey } from "../i18n";

/**
 * Half the track's virtual width, and therefore the worst possible score:
 * stopping at either end is this far off centre.
 *
 * Virtual units, not pixels. The track renders at whatever width the screen
 * allows, but positions are always expressed against this fixed scale, so a
 * phone and a kiosk produce comparable scores and the server can bound-check a
 * submission without knowing anything about the display. Mirrors
 * game.PrecisionTrackHalf in the backend — the two must agree or the validator
 * rejects honest rounds.
 */
export const TRACK_HALF = 100;

/** The full sweep, end to end. Centre is at TRACK_HALF. */
export const TRACK_WIDTH = TRACK_HALF * 2;

/** The score for a player who never stops the marker: the worst legal one. */
export const WORST_SCORE = TRACK_HALF;

/**
 * How far off centre still fills the reveal meter, mirroring the game's
 * TargetScore, and how far still wins something at all. Both are drawn on the
 * track so the player can see what they are aiming at instead of discovering
 * the thresholds on the result screen.
 */
export const BULLSEYE_OFF = 5;
export const NEAR_OFF = 25;

/** One full there-and-back sweep, in ms. */
export const SWEEP_PERIOD_MS = 1400;

/**
 * How long the track holds after a stop, before the round hands off.
 *
 * Without it the screen changes on the same pointer event that ends the round,
 * so the one thing the player was aiming at — where the marker actually
 * stopped — is never shown. The score reveal that follows says how far off they
 * were as a number; only the track can say it as a *place*, and it is gone by
 * then.
 *
 * Deliberately NOT routed through pacing.holdMs, which collapses every beat to
 * zero under reduced motion. That rule is right for the celebration and the
 * reveal, which are motion; this beat is a readout that happens to be
 * animated. The ring drawn on it is decoration and the global reduce-motion
 * rule in index.css already neutralises that, leaving the frozen marker and the
 * verdict — which is exactly what a player who asked for less movement should
 * still get.
 *
 * Short on purpose: the celebration is 1600ms away and the reveal 2200ms behind
 * that, so this is paying into an ending that is already long.
 */
export const STOP_HOLD_MS = 700;

/**
 * Where the marker is at `elapsedMs`, as a position in 0…TRACK_WIDTH.
 *
 * A triangle wave: the marker runs to one end, turns, and comes back at the
 * same speed, because an eased turn would make the ends easier to hit than the
 * middle and this game is only interesting if the middle is the hard part.
 *
 * `phase` is the starting offset (0–1), drawn by the caller. Randomness is
 * passed IN rather than taken here so the function stays pure and testable —
 * the same reason waitDelayMs takes its draw. It also means a player cannot
 * learn one fixed opening and count their way to the centre.
 */
export function sweepPosition(elapsedMs: number, phase: number, periodMs = SWEEP_PERIOD_MS): number {
  const safeElapsed = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
  const safePhase = Number.isFinite(phase) ? phase : 0;
  const period = periodMs > 0 ? periodMs : SWEEP_PERIOD_MS;

  // Modulo of a sum that is always non-negative, so no negative-remainder case.
  const t = (safeElapsed / period + Math.abs(safePhase)) % 1;
  const triangle = t < 0.5 ? t * 2 : 2 - t * 2;
  return triangle * TRACK_WIDTH;
}

/**
 * The score for stopping at `position`: the distance from centre, rounded.
 *
 * Zero is a legal, and indeed the intended, result. Every other game in the
 * catalog has a score that cannot reach zero, which is precisely the assumption
 * this game exists to break — see benchmarkFor in ../reveal/calc.
 */
export function missDistance(position: number): number {
  if (!Number.isFinite(position)) return WORST_SCORE;
  const off = Math.round(Math.abs(position - TRACK_HALF));
  return Math.max(0, Math.min(WORST_SCORE, off));
}

/** A position as a 0–100 percentage across the track, for placing it visually. */
export function trackPercent(position: number): number {
  if (!Number.isFinite(position)) return 50;
  const pct = (position / TRACK_WIDTH) * 100;
  return Math.max(0, Math.min(100, pct));
}

/** How wide a "within `off` of centre" band is, as a percentage of the track. */
export function zoneWidthPercent(off: number): number {
  const safe = Number.isFinite(off) ? Math.max(0, off) : 0;
  return Math.min(100, ((safe * 2) / TRACK_WIDTH) * 100);
}

/**
 * Rating shown the moment a stop lands, for immediate feedback.
 *
 * Returns a message key, not a word: which band a stop falls into is a rule
 * about this game and belongs here, while what that band is CALLED is a
 * translation and belongs in ../i18n. The component looks it up.
 */
export function precisionVerdict(off: number): MessageKey {
  if (off <= 0) return "precision.verdict.perfect";
  if (off <= BULLSEYE_OFF) return "precision.verdict.deadOn";
  if (off <= 12) return "precision.verdict.close";
  if (off <= NEAR_OFF) return "precision.verdict.near";
  return "precision.verdict.wide";
}
