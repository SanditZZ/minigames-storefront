import { describe, expect, it } from "vitest";
import {
  MAX_WAIT_MS,
  MIN_WAIT_MS,
  isFalseStart,
  reactionScore,
  reactionVerdict,
  waitDelayMs,
} from "./reaction";

describe("waitDelayMs", () => {
  it("spans exactly the configured window", () => {
    expect(waitDelayMs(0)).toBe(MIN_WAIT_MS);
    expect(waitDelayMs(1)).toBe(MAX_WAIT_MS);
    expect(waitDelayMs(0.5)).toBe((MIN_WAIT_MS + MAX_WAIT_MS) / 2);
  });

  // A draw outside 0–1 must not produce a wait outside the window, or the round
  // could flip instantly (free win) or never (dead screen).
  it("clamps a draw outside 0–1", () => {
    expect(waitDelayMs(-5)).toBe(MIN_WAIT_MS);
    expect(waitDelayMs(9)).toBe(MAX_WAIT_MS);
    expect(waitDelayMs(Number.NaN)).toBe(MIN_WAIT_MS);
  });

  it("never leaves the window for any draw in range", () => {
    for (let i = 0; i <= 100; i++) {
      const got = waitDelayMs(i / 100);
      expect(got).toBeGreaterThanOrEqual(MIN_WAIT_MS);
      expect(got).toBeLessThanOrEqual(MAX_WAIT_MS);
    }
  });
});

describe("reactionScore", () => {
  const ceiling = 3000;

  it("rounds a normal reaction", () => {
    expect(reactionScore(243.6, ceiling)).toBe(244);
  });

  // The server rejects anything above the ceiling, so the client must never
  // submit it — "never reacted" has to land on the ceiling itself.
  it("clamps to the ceiling", () => {
    expect(reactionScore(9999, ceiling)).toBe(ceiling);
    expect(reactionScore(ceiling, ceiling)).toBe(ceiling);
  });

  it("treats nonsense timings as the worst result rather than a free win", () => {
    expect(reactionScore(-1, ceiling)).toBe(ceiling);
    expect(reactionScore(Number.NaN, ceiling)).toBe(ceiling);
    expect(reactionScore(Number.POSITIVE_INFINITY, ceiling)).toBe(ceiling);
  });
});

describe("isFalseStart", () => {
  it("is a false start only before the flip", () => {
    expect(isFalseStart(false)).toBe(true);
    expect(isFalseStart(true)).toBe(false);
  });
});

describe("reactionVerdict", () => {
  it("rates faster reactions more highly", () => {
    expect(reactionVerdict(150)).toBe("Lightning");
    expect(reactionVerdict(240)).toBe("Sharp");
    expect(reactionVerdict(300)).toBe("Solid");
    expect(reactionVerdict(450)).toBe("Steady");
    expect(reactionVerdict(1200)).toBe("Sleepy");
  });

  it("always returns a label, including at the boundaries", () => {
    for (const ms of [0, 199, 200, 259, 260, 349, 350, 499, 500, 3000]) {
      expect(reactionVerdict(ms)).not.toBe("");
    }
  });
});
