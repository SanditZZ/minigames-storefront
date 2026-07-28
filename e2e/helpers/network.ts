import type { Page } from "@playwright/test";

/**
 * ACTIONS layer: watching what a page actually asks the network for.
 *
 * Some rules are about the SHAPE of a page's traffic rather than about anything
 * it renders — "the landing screen asks for prizes once, not once per game" is
 * true or false with identical pixels either way. Nothing in the DOM can be
 * asserted on to catch a regression like that.
 */

/**
 * Starts counting requests whose URL matches `pattern`, and returns a reader
 * for the running total.
 *
 * Call it BEFORE the navigation you mean to measure: a listener attached
 * afterwards misses the requests the page has already made, and reads zero —
 * which looks exactly like a page that behaved.
 *
 * Prefer asserting that a count is ZERO over asserting it is one. The suite
 * drives Vite's dev server, where React's StrictMode double-invokes effects, so
 * a page that correctly makes one request is observed making two. "This route
 * is never called" survives that; "called exactly once" does not.
 */
export function countRequests(page: Page, pattern: RegExp): () => number {
  let seen = 0;
  page.on("request", (req) => {
    if (pattern.test(req.url())) seen++;
  });
  return () => seen;
}

/**
 * The per-game prize route, which the landing screen must never call.
 *
 * It still exists and still answers — it is the read for one game's ladder —
 * but the showcase advertises the whole catalog, so calling it there cost a
 * request AND a full awards scan per game, growing with every game added. The
 * batched `GET /api/v1/awards` replaced it; this pattern is what notices the
 * loop coming back.
 */
export const PER_GAME_PRIZES = /\/games\/[^/]+\/awards/;
