// DATA layer: where the throwaway stack lives. Nothing here has behaviour.
//
// This file exists because the suite now drives TWO apps. The player app is
// reached through `baseURL`, which Playwright resolves for a bare
// `page.goto("/")` — but there is only one of those, so the admin's origin has
// to be written down somewhere a spec can read it. Written down in
// playwright.config.ts alone it would have to be restated in the helper, and a
// constant copied into a second file drifts silently rather than failing.
//
// Where a value has a source, IMPORT it instead of copying it here — the ports
// below have none, but `END_OF_ROUND_MS` in helpers/round.ts once did the same
// thing to the app's pacing constants and no longer does. Being outside the
// frontend workspace stops npm from linking `@minigames/*`; it does not stop a
// relative import of a pure module. See the comment on that constant.
//
// The ports are deliberately far from the dev defaults (5173/5174/8080) and
// from each other's neighbours. A suite that reused a dev port would pass
// against whatever the developer happened to have running and wipe its database
// out from under them.

export const API_PORT = 8299;
export const WEB_PORT = 5299;
export const ADMIN_PORT = 5298;

export const API_URL = `http://127.0.0.1:${API_PORT}`;
export const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;

/**
 * The admin app's own origin.
 *
 * The admin is a SEPARATE origin from the player, not a route on it — that is
 * how it is deployed (two Vite builds, two ports; see scripts/serve-prod.sh),
 * so a suite that drove it from the player's origin would be exercising a
 * topology nobody ships, and would never touch the CORS configuration that
 * makes the real thing work.
 */
export const ADMIN_URL = `http://127.0.0.1:${ADMIN_PORT}`;

/**
 * The shared secret the throwaway API is started with.
 *
 * It is the same default the app ships for local development. That is fine
 * here and would not be anywhere else: this API is bound to loopback, holds a
 * database created seconds ago, and is killed when the run ends.
 */
export const ADMIN_TOKEN = "admin";

/**
 * The store's name in a freshly seeded database (`domain.DefaultStoreName`),
 * and the fallback the player bundle carries when it has no settings at all
 * (`brand.name` in player-core's dictionaries).
 *
 * Two constants rather than one, because the whole point is that they DISAGREE.
 * A spec that reads the seeded name off the screen has proved the settings were
 * fetched; one that reads the fallback has proved they were not. While both
 * sides spelled "Fun Store" neither assertion meant anything — see the comment
 * on the seed for the full argument.
 *
 * Restated here rather than imported: nothing in this package can reach a Go
 * constant. That is a copy, so it can drift — but it drifts LOUDLY, unlike a
 * duplicated timing: a renamed seed makes every branding assertion fail on the
 * next run rather than quietly weakening one.
 */
export const SEEDED_STORE_NAME = "Sunny Mart";
export const BUNDLED_STORE_NAME = "Fun Store";
