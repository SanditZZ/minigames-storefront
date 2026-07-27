import { describe, expect, it } from "vitest";
import { canStep, clampNumber, parseNumber, stepNumber } from "./number";

describe("parseNumber", () => {
  /**
   * The whole reason this module exists. `Number("")` is 0, so a form that pipes
   * its field straight through coercion proposes a real change the moment an
   * operator backspaces to retype — and 0 is a legal score threshold, so nothing
   * downstream can tell that value from a deliberate one.
   */
  it("reads an empty field as nothing, not as zero", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("   ")).toBeNull();
    expect(Number("")).toBe(0); // the trap being avoided, pinned so it stays visible
  });

  it("reads a number as itself", () => {
    expect(parseNumber("0")).toBe(0);
    expect(parseNumber("42")).toBe(42);
    expect(parseNumber("-7")).toBe(-7);
    expect(parseNumber(" 168 ")).toBe(168);
    expect(parseNumber("1.5")).toBe(1.5);
  });

  it("reads anything that is not a number as nothing", () => {
    for (const text of ["abc", "1abc", "--3", "NaN", "Infinity", "1e", "#5"]) {
      expect(parseNumber(text)).toBeNull();
    }
  });

  // Parsing answers "what did they type"; clamping answers "what is allowed".
  // Conflating them would snap a value mid-keystroke and fight the operator.
  it("does not clamp or snap", () => {
    expect(parseNumber("999999")).toBe(999999);
    expect(parseNumber("-999")).toBe(-999);
  });
});

describe("clampNumber", () => {
  it("passes an in-range value through untouched", () => {
    expect(clampNumber(5, { min: 0, max: 10 })).toBe(5);
    expect(clampNumber(5)).toBe(5);
  });

  it("brings an out-of-range value to the nearest bound", () => {
    expect(clampNumber(-3, { min: 0 })).toBe(0);
    expect(clampNumber(99, { max: 10 })).toBe(10);
  });

  it("snaps to the step grid, offset from min rather than from zero", () => {
    // A field starting at 1 with a step of 2 offers 1, 3, 5 — not 0, 2, 4.
    expect(clampNumber(4, { min: 1, step: 2 })).toBe(5);
    expect(clampNumber(3.6, { step: 1 })).toBe(4);
    expect(clampNumber(12, { step: 5, min: 0 })).toBe(10);
  });

  /**
   * Snap-then-clamp, in that order: snapping can push a value past a bound, so
   * the clamp has to have the final word or the control would offer a value its
   * own `max` forbids.
   */
  it("lets the clamp win when snapping would leave the range", () => {
    // 96 snaps UP to 100, which the max then pulls back to 95. (94 snaps DOWN to
    // 90 and never leaves the range, which is why it is the wrong case to test.)
    expect(clampNumber(96, { min: 0, max: 95, step: 10 })).toBe(95);
    expect(clampNumber(94, { min: 0, max: 95, step: 10 })).toBe(90);
    expect(clampNumber(2, { min: 1, max: 100, step: 10 })).toBe(1);
  });

  it("ignores a step that cannot describe a grid", () => {
    expect(clampNumber(7, { step: 0 })).toBe(7);
    expect(clampNumber(7, { step: -1 })).toBe(7);
  });

  // Repeated addition of a fractional step drifts; nobody types 0.30000000000000004.
  it("does not accumulate floating-point noise", () => {
    expect(clampNumber(0.3, { step: 0.1 })).toBe(0.3);
    expect(clampNumber(0.7, { step: 0.1 })).toBe(0.7);
  });
});

describe("stepNumber", () => {
  it("moves by one step in the direction asked", () => {
    expect(stepNumber(5, 1, { step: 1 })).toBe(6);
    expect(stepNumber(5, -1, { step: 1 })).toBe(4);
    expect(stepNumber(10, 1, { step: 5 })).toBe(15);
  });

  it("defaults to a step of one when none is given", () => {
    expect(stepNumber(5, 1)).toBe(6);
    expect(stepNumber(5, -1)).toBe(4);
  });

  /**
   * An empty field steps to its own FLOOR, not to zero: pressing `+` on a blank
   * benchmark whose min is 1 should offer 1, and 0 would be a value the field
   * itself rejects.
   */
  it("steps an empty field to its floor", () => {
    expect(stepNumber(null, 1, { min: 1 })).toBe(1);
    expect(stepNumber(null, -1, { min: 1 })).toBe(1);
    expect(stepNumber(null, 1)).toBe(0);
  });

  it("cannot be walked out of range", () => {
    expect(stepNumber(0, -1, { min: 0 })).toBe(0);
    expect(stepNumber(10, 1, { min: 0, max: 10 })).toBe(10);
  });

  /**
   * `Award.stock` uses -1 as the UNLIMITED_STOCK sentinel, and the form offers it
   * as a checkbox. Holding the `−` button down must never arrive there by
   * accident: the field is bounded at 0, so the clamp stops it dead.
   */
  it("cannot reach the unlimited-stock sentinel by stepping down", () => {
    let v: number | null = 3;
    for (let i = 0; i < 20; i++) v = stepNumber(v, -1, { min: 0, step: 1 });
    expect(v).toBe(0);
  });
});

describe("canStep", () => {
  it("is false only where the value cannot move", () => {
    expect(canStep(0, -1, { min: 0 })).toBe(false);
    expect(canStep(10, 1, { max: 10 })).toBe(false);
    expect(canStep(5, 1, { min: 0, max: 10 })).toBe(true);
    expect(canStep(5, -1, { min: 0, max: 10 })).toBe(true);
  });

  // An empty field can always be stepped — that is how it acquires a value.
  it("is true for an empty field in either direction", () => {
    expect(canStep(null, 1, { min: 0, max: 0 })).toBe(true);
    expect(canStep(null, -1, { min: 0, max: 0 })).toBe(true);
  });

  /**
   * A value already outside its bounds must not report itself as stuck: stepping
   * it is the operator's way back into range. This is why `canStep` compares
   * against the value as it is rather than against its clamped form — under the
   * latter, a typed 999 beneath a max of 100 would disable the very button that
   * fixes it, since 999 and 998 both clamp to 100.
   */
  it("is true for an out-of-range value being brought back", () => {
    expect(canStep(-5, 1, { min: 0 })).toBe(true);
    expect(canStep(999, -1, { max: 100 })).toBe(true);
  });
});
