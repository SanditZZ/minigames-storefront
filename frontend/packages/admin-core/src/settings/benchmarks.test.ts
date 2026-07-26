import { describe, expect, it } from "vitest";
import type { Game, Setting } from "@minigames/api-client";
import {
  benchmarkChanges,
  benchmarksDirty,
  invalidBenchmarks,
  readBenchmarks,
  targetScoreKey,
} from "./benchmarks";

const game = (slug: string, targetScore: number): Game => ({
  slug,
  name: slug,
  description: "",
  scoreUnit: "taps",
  direction: "higher",
  durationMs: 10000,
  targetScore,
  enabled: true,
});

const row = (key: string, value: string): Setting => ({
  key,
  value,
  type: "int",
  description: "",
  updatedAt: "2026-07-26T00:00:00Z",
});

describe("targetScoreKey", () => {
  // Mirrors settings.TargetScoreKey in Go. If these two ever disagree the admin
  // writes a setting the backend never reads, and nothing else would notice.
  it("matches the Go key shape", () => {
    expect(targetScoreKey("tap-fast")).toBe("target_score_tap_fast");
    expect(targetScoreKey("precision-stop")).toBe("target_score_precision_stop");
  });
});

describe("readBenchmarks", () => {
  it("reads the stored override per game, blank when there is none", () => {
    expect(
      readBenchmarks(
        [game("tap-fast", 40), game("precision-stop", 5)],
        [row(targetScoreKey("tap-fast"), "40")],
      ),
    ).toEqual({ "tap-fast": "40", "precision-stop": "" });
  });
});

describe("invalidBenchmarks", () => {
  it("accepts a positive integer and an empty box", () => {
    expect(invalidBenchmarks({ a: "40", b: "", c: " 7 " })).toEqual([]);
  });

  // 0 is not a clear — the client reads 0 as "unset" and falls back to scaling
  // against the leaderboard leader, the moving denominator the fixed benchmark
  // was introduced to remove.
  it("rejects zero, negatives and non-integers", () => {
    expect(invalidBenchmarks({ a: "0" })).toEqual(["a"]);
    expect(invalidBenchmarks({ a: "-5" })).toEqual(["a"]);
    expect(invalidBenchmarks({ a: "40.5" })).toEqual(["a"]);
    expect(invalidBenchmarks({ a: "sixty" })).toEqual(["a"]);
  });
});

describe("benchmarkChanges", () => {
  it("writes only the game that changed", () => {
    const saved = { "tap-fast": "40", "precision-stop": "" };
    expect(benchmarkChanges({ ...saved, "precision-stop": "8" }, saved)).toEqual([
      { key: targetScoreKey("precision-stop"), slug: "precision-stop", value: "8", previous: "" },
    ]);
  });

  it("reports a cleared override as an empty value, which the caller deletes", () => {
    const saved = { "tap-fast": "40" };
    expect(benchmarkChanges({ "tap-fast": "" }, saved)).toEqual([
      { key: targetScoreKey("tap-fast"), slug: "tap-fast", value: "", previous: "40" },
    ]);
  });

  it("is empty when nothing changed", () => {
    const saved = { "tap-fast": "40" };
    expect(benchmarkChanges(saved, saved)).toEqual([]);
    expect(benchmarksDirty(saved, saved)).toBe(false);
  });
});
