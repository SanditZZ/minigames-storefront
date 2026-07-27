// CALCULATIONS layer: what a number field's text means, and what a bounded,
// stepped number does when it is nudged.
//
// This is the arithmetic half of `NumberInput` (apps/admin/src/ui/Controls.tsx),
// extracted for the same reason `duration.ts` was: a rounding rule buried in an
// onChange handler is a rounding rule nothing tests. Every admin numeric field
// goes through here, so "what happens when I clear the box and retype" has one
// answer instead of one per form.
//
// The distinction the whole module is built around: **empty is not zero.** A
// field mid-edit legitimately holds nothing, and coercing that to 0 as the
// operator backspaces is how a form silently proposes a real change nobody
// typed — `Number("")` is 0 in JavaScript, which is exactly the trap. `null`
// travels all the way through instead, and only the caller decides what an empty
// field should mean when it is finally saved.

/** The shape of a bounded, stepped number. All three are optional. */
export interface NumberBounds {
  min?: number;
  max?: number;
  /**
   * The grid a value snaps to, offset from `min` (or 0). Snapping happens on
   * COMMIT, never per keystroke: rounding "12" to the nearest 5 while someone is
   * still typing "125" would fight the operator for the field.
   */
  step?: number;
}

/**
 * What the text in a number field means: a finite number, or null for nothing.
 *
 * Null covers empty, whitespace, and anything that is not a number at all — a
 * pasted "abc" is no more a value than an empty box is. Deliberately does NOT
 * clamp or snap: this answers "what did they type", and `clampNumber` answers
 * "what is allowed", which are different questions asked at different moments
 * (every keystroke versus commit).
 */
export function parseNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/**
 * Brings a value inside its bounds and onto its step grid.
 *
 * Order matters and is snap-then-clamp: snapping can push a value out of range
 * (a step of 10 with a max of 95 rounds 96 up to 100), so the clamp goes last and
 * has the final word. The grid is offset from `min` rather than from zero,
 * because a field starting at 1 with a step of 2 should offer 1, 3, 5 — not 0, 2,
 * 4 with the first one rejected.
 */
export function clampNumber(value: number, bounds: NumberBounds = {}): number {
  const { min, max, step } = bounds;
  let out = value;

  if (step !== undefined && step > 0) {
    const base = min ?? 0;
    out = base + Math.round((out - base) / step) * step;
    // Re-derive through the step count rather than accumulating: repeated
    // addition of a fractional step drifts, and a duration of 0.30000000000000004
    // hours is a number no operator typed.
    out = Number(out.toPrecision(12));
  }
  if (min !== undefined && out < min) out = min;
  if (max !== undefined && out > max) out = max;
  return out;
}

/**
 * One press of a stepper: the next value up or down, already clamped.
 *
 * An EMPTY field steps to its own floor rather than to zero — `min` if it has
 * one, else 0. Pressing `+` on a blank box should offer the smallest legal value,
 * which for a benchmark whose `min` is 1 is 1 and not an invalid 0.
 *
 * Because the result is clamped, a stepper cannot walk a value out of range. That
 * is what keeps `Award.stock` safe next to its sentinel: the field is bounded at
 * `min: 0`, so decrementing from 0 stays at 0 and can never arrive at the `-1`
 * that means UNLIMITED_STOCK. The sentinel stays where it belongs — behind the
 * form's explicit "Unlimited" checkbox — rather than being a number an operator
 * could stumble into by holding a button down.
 */
export function stepNumber(value: number | null, direction: 1 | -1, bounds: NumberBounds = {}): number {
  const step = bounds.step !== undefined && bounds.step > 0 ? bounds.step : 1;
  if (value === null) return clampNumber(bounds.min ?? 0, bounds);
  return clampNumber(value + direction * step, bounds);
}

/**
 * Whether a stepper in this direction can still change anything, for disabling
 * the button at the end of its range.
 *
 * A disabled control is the honest signal that a value has bottomed out; a button
 * that stays live and does nothing invites the operator to press it harder. An
 * empty field can always be stepped — that is how it acquires a value.
 *
 * Compared against the value AS IT IS, not against its clamped form. The
 * difference shows on a field holding something out of range — a typed 999 under
 * a max of 100 — where both the current value and the stepped one clamp to the
 * bound. Comparing clamped forms would call that stuck and disable the button
 * that is the operator's way back into range.
 */
export function canStep(value: number | null, direction: 1 | -1, bounds: NumberBounds = {}): boolean {
  if (value === null) return true;
  return stepNumber(value, direction, bounds) !== value;
}
