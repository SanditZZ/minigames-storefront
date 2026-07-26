// CALCULATIONS layer: the per-game benchmark overrides.
//
// A game's `targetScore` is the value at which the score reveal reads full. It
// is catalog data — it lives in Go, in `internal/game/catalog.go` — and this is
// the layer that lets a venue retune it without a deploy ("our tote bag is 40
// taps, not 60").
//
// What arrives on `Game.targetScore` from the API is ALREADY the tuned number:
// the backend layers the override on read. So the form has two different
// numbers to keep straight — the effective one (on the game) and the override
// one (in the settings row) — and an empty box means "no override, follow the
// catalog", exactly as an empty colour means "follow the tokens".

import type { Game, Setting } from "@minigames/api-client";
import { settingValue } from "./map";

/**
 * The setting key that overrides one game's benchmark. Mirrors
 * settings.TargetScoreKey in Go — hyphens become underscores so the key reads
 * like every other setting.
 */
export function targetScoreKey(slug: string): string {
  return `target_score_${slug.replaceAll("-", "_")}`;
}

/** Benchmark overrides by game slug. "" means no override. */
export type BenchmarkDraft = Record<string, string>;

/** One write a save must perform. An empty value is a delete. */
export interface BenchmarkChange {
  key: string;
  slug: string;
  value: string;
  previous: string;
}

/** The stored overrides for the games given, as form fields. */
export function readBenchmarks(
  games: Game[] | null | undefined,
  settings: Setting[] | null | undefined,
): BenchmarkDraft {
  const out: BenchmarkDraft = {};
  for (const g of games ?? []) out[g.slug] = settingValue(settings, targetScoreKey(g.slug));
  return out;
}

/**
 * Benchmarks that are set to something that is not a usable target.
 *
 * Zero is rejected rather than treated as a clear, because zero already means
 * "unset" to the player client — it falls back to scaling the reveal against
 * the current leaderboard leader, which is the moving denominator the fixed
 * benchmark exists to remove. Clearing the box is how you go back to the
 * catalog; typing 0 is a mistake worth naming.
 */
export function invalidBenchmarks(draft: BenchmarkDraft): string[] {
  return Object.keys(draft).filter((slug) => {
    const raw = draft[slug].trim();
    if (raw === "") return false;
    return !/^\d+$/.test(raw) || Number(raw) <= 0;
  });
}

/** The writes a save has to make — only what changed. */
export function benchmarkChanges(
  draft: BenchmarkDraft,
  saved: BenchmarkDraft,
): BenchmarkChange[] {
  const out: BenchmarkChange[] = [];
  for (const slug of Object.keys(draft)) {
    const previous = saved[slug] ?? "";
    if (draft[slug] === previous) continue;
    out.push({ key: targetScoreKey(slug), slug, value: draft[slug].trim(), previous });
  }
  return out;
}

/** True when the draft differs from what is stored. */
export function benchmarksDirty(draft: BenchmarkDraft, saved: BenchmarkDraft): boolean {
  return benchmarkChanges(draft, saved).length > 0;
}
