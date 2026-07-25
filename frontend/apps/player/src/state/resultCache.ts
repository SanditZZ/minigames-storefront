// Mutable module state, isolated in its own file with accessors (never mixed
// into a component or a calculation file).
//
// Why it exists: a finished round is handed from the play screen to the result
// screen through the URL, and a URL can only carry an id. The result itself was
// already in hand from the submit response, so it is parked here for one hop —
// otherwise the player would watch a spinner while the app re-fetched something
// it just received.
//
// It is only ever an optimisation. The result screen falls back to the API when
// the cache misses, which is exactly what happens on a reload or a shared link.

import type { SubmitResult } from "@minigames/api-client";

let pending: { id: string; result: SubmitResult } | null = null;

/** Parks a freshly submitted result for the result screen to pick up. */
export function stashResult(result: SubmitResult): void {
  pending = { id: result.score.id, result };
}

/**
 * Takes the stashed result for an id, if it is the one waiting. Consuming it
 * clears the slot, so a later reload genuinely re-fetches instead of showing a
 * stale rank.
 */
export function takeResult(id: string): SubmitResult | null {
  if (!pending || pending.id !== id) return null;
  const { result } = pending;
  pending = null;
  return result;
}
