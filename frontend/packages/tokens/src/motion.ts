// DATA layer: how long things take and how they ease. No CSS, no keyframes.
//
// The SHAPE of an animation (what actually moves) is platform-specific — the
// web describes it with @keyframes, React Native with a Reanimated worklet, and
// neither can express the other. The TIMING is not: "the pop-in lasts 420ms on
// a back-eased curve" is the same design decision on both, and it is the part
// that drifts if each platform re-types its own number.
//
// So this file holds durations and easings only. Each app's index.css keeps its
// @keyframes; the generator composes them with these values.

/** A cubic-bezier as its four control points, the one form both platforms take. */
export type Easing = readonly [number, number, number, number];

export const EASING = {
  /** Overshoots and settles — for something arriving with weight. */
  back: [0.34, 1.56, 0.64, 1],
  /** Fast out, long settle. The default for anything entering the screen. */
  out: [0.22, 1, 0.36, 1],
  /** Gentle both ends, for loops that should not draw the eye. */
  inOut: [0.25, 0.6, 0.4, 1],
} as const satisfies Record<string, Easing>;

export type EasingName = keyof typeof EASING;

/** One named animation's timing. `web` names the @keyframes it composes with. */
export interface MotionToken {
  durationMs: number;
  easing: EasingName | "ease-out" | "ease-in-out" | "linear";
  /** Iteration count; "infinite" for decorative loops. */
  iterations: number | "infinite";
  /**
   * Which frames persist outside the run.
   *
   * Not a boolean: `both` also applies the FIRST frame before the animation
   * starts, which is what stops an entering element flashing at full opacity
   * for one frame; `forwards` only holds the last. Confetti and the floating
   * "+1" need `forwards` — their final frame is invisible, and without it the
   * particles snap back into view when the animation ends.
   */
  fill: "both" | "forwards" | "none";
  keyframes: string;
}

/**
 * The motion kit, keyed by the Tailwind utility each one becomes
 * (`pop-in` → `animate-pop-in`).
 *
 * REVEAL_DURATION_MS in player-core is deliberately NOT here: it is the length
 * of a gameplay beat that the score maths is written against and that the
 * player can skip, not a decorative timing. It belongs with the reveal logic.
 */
export const MOTION = {
  "pop-in": { durationMs: 420, easing: "back", iterations: 1, fill: "both", keyframes: "pop-in" },
  "rise-in": { durationMs: 500, easing: "out", iterations: 1, fill: "both", keyframes: "rise-in" },
  // The same arrival with the fade taken out — identical duration and easing on
  // purpose, so the two read as one motion language rather than two.
  //
  // It exists for the claim card, and the reason is not aesthetic: a QR at
  // partial opacity over cream has too little contrast for a camera to decode,
  // so the whole entrance was a window in which the one graphic on screen that
  // a scanner is meant to read could not be read. Opacity cannot be opted out
  // of from below — a child cannot escape an ancestor's — so the exemption has
  // to be the ancestor's animation, which is this.
  "rise-solid": { durationMs: 500, easing: "out", iterations: 1, fill: "both", keyframes: "rise-solid" },
  halo: { durationMs: 1800, easing: "ease-out", iterations: "infinite", fill: "none", keyframes: "halo" },
  bob: { durationMs: 2400, easing: "ease-in-out", iterations: "infinite", fill: "none", keyframes: "bob" },
  confetti: { durationMs: 1600, easing: "inOut", iterations: 1, fill: "forwards", keyframes: "confetti" },
  flash: { durationMs: 700, easing: "ease-in-out", iterations: "infinite", fill: "none", keyframes: "flash" },
  "float-up": { durationMs: 650, easing: "out", iterations: 1, fill: "forwards", keyframes: "float-up" },
  urgent: { durationMs: 400, easing: "ease-in-out", iterations: "infinite", fill: "none", keyframes: "urgent" },
} as const satisfies Record<string, MotionToken>;

export type MotionName = keyof typeof MOTION;

/** Renders an easing as the CSS function. Pure. */
export function cssEasing(easing: MotionToken["easing"]): string {
  if (easing in EASING) {
    const [a, b, c, d] = EASING[easing as EasingName];
    return `cubic-bezier(${a}, ${b}, ${c}, ${d})`;
  }
  return easing;
}
