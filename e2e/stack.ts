// DATA layer: where the throwaway stack lives. Nothing here has behaviour.
//
// This file exists because the suite now drives TWO apps. The player app is
// reached through `baseURL`, which Playwright resolves for a bare
// `page.goto("/")` — but there is only one of those, so the admin's origin has
// to be written down somewhere a spec can read it. Written down in
// playwright.config.ts alone it would have to be restated in the helper, which
// is exactly the failure mode `END_OF_ROUND_MS` already demonstrates: a
// constant copied into a second file drifts silently rather than failing.
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
