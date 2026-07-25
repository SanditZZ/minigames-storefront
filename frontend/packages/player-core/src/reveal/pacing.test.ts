import { describe, expect, it } from "vitest";
import { COMPLETE_BEAT_MS, endOfRoundMs, holdMs, REVEAL_DURATION_MS } from "./pacing";

describe("holdMs", () => {
  it("holds for the full beat by default", () => {
    expect(holdMs(COMPLETE_BEAT_MS, false)).toBe(COMPLETE_BEAT_MS);
    expect(holdMs(REVEAL_DURATION_MS, false)).toBe(REVEAL_DURATION_MS);
  });

  // The only input still permitted to shorten the sequence. Someone who told
  // their OS that movement makes them unwell is not skipping a celebration,
  // they are declining to be shown one.
  it("collapses to zero under reduced motion", () => {
    expect(holdMs(COMPLETE_BEAT_MS, true)).toBe(0);
    expect(holdMs(REVEAL_DURATION_MS, true)).toBe(0);
  });

  it("never returns a negative hold, however the data is edited", () => {
    expect(holdMs(-500, false)).toBe(0);
    expect(holdMs(0, false)).toBe(0);
  });
});

describe("endOfRoundMs", () => {
  it("is both beats end to end", () => {
    expect(endOfRoundMs(false)).toBe(COMPLETE_BEAT_MS + REVEAL_DURATION_MS);
  });

  it("is instant under reduced motion", () => {
    expect(endOfRoundMs(true)).toBe(0);
  });

  // The sequence is the player's reward for finishing; if a refactor ever
  // trims it to nothing there is no animation left to be unskippable.
  it("is long enough to be worth protecting", () => {
    expect(endOfRoundMs(false)).toBeGreaterThan(3000);
  });
});
