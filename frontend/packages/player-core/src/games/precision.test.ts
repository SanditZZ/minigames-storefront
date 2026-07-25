import { describe, expect, it } from "vitest";
import {
  BULLSEYE_OFF,
  SWEEP_PERIOD_MS,
  TRACK_HALF,
  TRACK_WIDTH,
  WORST_SCORE,
  missDistance,
  precisionVerdict,
  sweepPosition,
  trackPercent,
  zoneWidthPercent,
} from "./precision";

describe("sweepPosition", () => {
  it("runs end to end and back within one period", () => {
    expect(sweepPosition(0, 0)).toBe(0);
    expect(sweepPosition(SWEEP_PERIOD_MS / 4, 0)).toBeCloseTo(TRACK_HALF);
    expect(sweepPosition(SWEEP_PERIOD_MS / 2, 0)).toBeCloseTo(TRACK_WIDTH);
    expect(sweepPosition((SWEEP_PERIOD_MS * 3) / 4, 0)).toBeCloseTo(TRACK_HALF);
    // Back to the start, ready to repeat — no jump at the wrap.
    expect(sweepPosition(SWEEP_PERIOD_MS, 0)).toBeCloseTo(0);
  });

  it("moves at a constant speed, so the middle is no easier than the ends", () => {
    // Equal time slices must cover equal distance on a single leg. An eased
    // turnaround would make the ends slow and the centre a coin flip.
    const step = SWEEP_PERIOD_MS / 20;
    const a = sweepPosition(step, 0) - sweepPosition(0, 0);
    const b = sweepPosition(step * 5, 0) - sweepPosition(step * 4, 0);
    expect(a).toBeCloseTo(b);
  });

  it("offsets by the drawn phase, so the opening is not learnable", () => {
    expect(sweepPosition(0, 0.25)).toBeCloseTo(TRACK_HALF);
    expect(sweepPosition(0, 0.5)).toBeCloseTo(TRACK_WIDTH);
  });

  it("stays on the track for nonsense input", () => {
    for (const [elapsed, phase] of [
      [Number.NaN, 0],
      [-500, 0],
      [1000, Number.NaN],
      [Number.POSITIVE_INFINITY, 0.3],
    ] as const) {
      const p = sweepPosition(elapsed, phase);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(TRACK_WIDTH);
    }
  });
});

describe("missDistance", () => {
  /**
   * The reason this game was built. Every other score in the catalog is bounded
   * away from zero — a tap count starts at 1, a reaction has a physiological
   * floor — so nothing exercised what a zero score does to the reveal meter or
   * the reward ladder until a perfect stop could produce one.
   */
  it("scores a perfect stop as zero", () => {
    expect(missDistance(TRACK_HALF)).toBe(0);
  });

  it("measures distance from centre in either direction", () => {
    expect(missDistance(TRACK_HALF + 12)).toBe(12);
    expect(missDistance(TRACK_HALF - 12)).toBe(12);
  });

  it("caps at the worst legal score the backend will accept", () => {
    expect(missDistance(0)).toBe(WORST_SCORE);
    expect(missDistance(TRACK_WIDTH)).toBe(WORST_SCORE);
    // Off the track entirely (or nonsense) is the worst score, never a value
    // the server's bound check would reject as fabricated.
    expect(missDistance(TRACK_WIDTH * 3)).toBe(WORST_SCORE);
    expect(missDistance(Number.NaN)).toBe(WORST_SCORE);
  });
});

describe("track geometry", () => {
  it("places the centre at the middle of the rendered track", () => {
    expect(trackPercent(TRACK_HALF)).toBe(50);
    expect(trackPercent(0)).toBe(0);
    expect(trackPercent(TRACK_WIDTH)).toBe(100);
  });

  it("never places a marker off the rendered track", () => {
    expect(trackPercent(-50)).toBe(0);
    expect(trackPercent(TRACK_WIDTH * 2)).toBe(100);
    expect(trackPercent(Number.NaN)).toBe(50);
  });

  it("sizes a target band as the share of the track it covers", () => {
    expect(zoneWidthPercent(BULLSEYE_OFF)).toBeCloseTo(5);
    expect(zoneWidthPercent(TRACK_HALF)).toBe(100);
    expect(zoneWidthPercent(-1)).toBe(0);
  });
});

describe("precisionVerdict", () => {
  it("reserves its best word for an exact stop", () => {
    expect(precisionVerdict(0)).toBe("Perfect");
    expect(precisionVerdict(BULLSEYE_OFF)).toBe("Dead on");
    expect(precisionVerdict(40)).toBe("Wide");
  });
});
