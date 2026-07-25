import { describe, expect, it } from "vitest";
import {
  bestScore,
  clamp01,
  countUpValue,
  easeOutCubic,
  isNewRecord,
  meterFraction,
  meterHeight,
  springSettle,
  tierFor,
} from "./calc";
import { TIERS } from "./tiers";

describe("meterFraction", () => {
  it("scales against the leader for higher-is-better", () => {
    expect(meterFraction(50, 100, "higher")).toBeCloseTo(0.5);
    expect(meterFraction(100, 100, "higher")).toBe(1);
  });

  it("inverts for lower-is-better, where the smaller time is the leader", () => {
    // Best reaction is 200ms; a 400ms round is half as good.
    expect(meterFraction(400, 200, "lower")).toBeCloseTo(0.5);
    expect(meterFraction(200, 200, "lower")).toBe(1);
    // Beating the leader still can't exceed the top of the tower.
    expect(meterFraction(100, 200, "lower")).toBe(1);
  });

  it("fills the tower when there is nothing to compare against", () => {
    expect(meterFraction(10, null, "higher")).toBe(1);
    expect(meterFraction(10, 0, "higher")).toBe(1);
    expect(meterFraction(10, Number.NaN, "higher")).toBe(1);
  });

  it("never returns a value outside the tower", () => {
    for (const [value, best] of [
      [500, 100],
      [-5, 100],
      [0, 100],
    ] as const) {
      const f = meterFraction(value, best, "higher");
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
    // A nonsensical zero/negative time is not a divide-by-zero.
    expect(meterFraction(0, 200, "lower")).toBe(1);
  });
});

describe("easing", () => {
  it("starts at zero and ends at one", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(springSettle(0)).toBe(0);
    // The spring decays onto its target rather than snapping.
    expect(springSettle(1)).toBeCloseTo(1, 2);
  });

  it("clamps input outside 0–1", () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(5)).toBe(1);
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(3)).toBe(1);
  });

  it("overshoots on the way up — that is the arcade bounce", () => {
    const peak = Math.max(...Array.from({ length: 101 }, (_, i) => springSettle(i / 100)));
    expect(peak).toBeGreaterThan(1);
  });
});

describe("meterHeight", () => {
  it("clips the overshoot at the top of the tower", () => {
    for (let i = 0; i <= 100; i++) {
      const h = meterHeight(1, i / 100);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(1);
    }
  });

  it("lands on the target fraction", () => {
    expect(meterHeight(0.5, 1)).toBeCloseTo(0.5, 2);
    expect(meterHeight(0, 1)).toBe(0);
  });
});

describe("countUpValue", () => {
  it("only ever climbs, and never past the real score", () => {
    // A number that overshoots and ticks back down reads as the game taking
    // points away — the puck may bounce, the digits may not.
    const target = 37;
    let previous = -1;
    for (let i = 0; i <= 200; i++) {
      const shown = countUpValue(target, i / 200);
      expect(shown).toBeGreaterThanOrEqual(previous);
      expect(shown).toBeLessThanOrEqual(target);
      previous = shown;
    }
  });

  it("starts at zero and finishes on the exact score", () => {
    expect(countUpValue(37, 0)).toBe(0);
    expect(countUpValue(37, 1)).toBe(37);
    expect(countUpValue(0, 1)).toBe(0);
  });
});

describe("tierFor", () => {
  it("picks the highest tier a fraction clears", () => {
    expect(tierFor(0).label).toBe("Warming up");
    expect(tierFor(0.2).label).toBe("Not bad");
    expect(tierFor(0.55).label).toBe("Sharp");
    expect(tierFor(1).label).toBe("Record breaker");
  });

  it("always resolves, even for out-of-range input", () => {
    expect(tierFor(-1)).toBe(TIERS[0]);
    expect(tierFor(99).label).toBe("Record breaker");
  });
});

describe("leaderboard helpers", () => {
  it("reads the leader off the top of the backend-ordered list", () => {
    expect(bestScore([{ value: 40 }, { value: 12 }])).toBe(40);
    expect(bestScore([])).toBeNull();
    expect(bestScore(null)).toBeNull();
  });

  it("treats only first place as a record", () => {
    expect(isNewRecord(1)).toBe(true);
    expect(isNewRecord(2)).toBe(false);
  });
});
