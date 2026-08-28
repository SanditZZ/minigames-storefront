// CALCULATIONS: the URL a store's TV/kiosk display shows for a game.
//
// The player app owns the `/display/:slug` route (`packages/player-core`'s
// route grammar); this is the admin's half — turning that route into a full
// URL an operator can copy or scan, given the player app's own origin (a
// separate Vite build/port, threaded in as `VITE_PLAYER_BASE_URL`).

/**
 * Builds the display URL for one game, given the player app's base origin.
 *
 * `baseUrl` may or may not carry a trailing slash — both the admin's env var
 * and a hand-typed fallback are equally likely to — so it is stripped rather
 * than assumed away, the same defensiveness `pathFor`'s callers get for free
 * from always starting a path with `/`.
 */
export function displayUrlFor(baseUrl: string, slug: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/display/${slug}`;
}
