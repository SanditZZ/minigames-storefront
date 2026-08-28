import { defineConfig, devices } from "@playwright/test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ADMIN_PORT, ADMIN_TOKEN, ADMIN_URL, API_PORT, API_URL, WEB_PORT, WEB_URL } from "./stack";

// The suite runs against its OWN stack — a throwaway SQLite file and dedicated
// ports — never the deployed one under .prod/. Test rounds must not land on the
// real leaderboard or burn real prize stock. The ports and origins live in
// stack.ts so the specs can reach the admin's origin without restating it.
const DB_PATH = join(tmpdir(), "minigames-e2e.db");
// Uploads land in a throwaway directory for the same reason the database does —
// and pointedly NOT in the default `uploads/`, which is relative to the API's
// working directory and would leave a stray folder inside backend/ on every run.
const UPLOAD_DIR = join(tmpdir(), "minigames-e2e-uploads");

// Start from an empty database every run: leftover scores would change ranks and
// silently invalidate assertions about being top of the board.
for (const suffix of ["", "-wal", "-shm"]) {
  rmSync(`${DB_PATH}${suffix}`, { force: true });
}
rmSync(UPLOAD_DIR, { recursive: true, force: true });

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // one shared backend + one leaderboard = run in sequence
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  // This suite gates every push, so absorb the occasional hiccup — but only
  // once, so a genuinely broken build still fails fast.
  retries: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: WEB_URL,
    // Playwright's default action timeout is NO LIMIT: an action waiting for an
    // element that will never appear waits for the `timeout` above instead, so
    // a single stalled click consumes the whole test budget and reports itself
    // as whatever call happened to run next. That is not hypothetical — it is
    // exactly how the tap loop in helpers/round.ts produced a 60s flake while
    // the test's honest duration was 11.6s. Bounding it here means an action
    // that cannot succeed fails as itself, quickly, and says so.
    actionTimeout: 5_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // The storefront is a phone-first kiosk app; test it at that size.
    ...devices["Pixel 7"],
  },

  projects: [{ name: "chromium", use: { ...devices["Pixel 7"] } }],

  webServer: [
    {
      command: "go run ./cmd/server",
      cwd: "../backend",
      url: `${API_URL}/healthz`,
      // Never reuse: the DB file was just deleted, so an already-running server
      // would be holding a stale (unlinked) database.
      reuseExistingServer: false,
      timeout: 120_000,
      // The API logs every request; piping it drowns the test output. Errors
      // still surface via stderr.
      stdout: "ignore",
      stderr: "pipe",
      env: {
        APP_ADDR: `:${API_PORT}`,
        APP_DB_PATH: DB_PATH,
        // Both origins, because both apps are now driven. Getting this wrong
        // fails as a browser CORS error rather than as an HTTP status, which
        // is worth knowing before debugging a blank admin panel.
        APP_CORS_ORIGINS: `${WEB_URL},${ADMIN_URL}`,
        APP_ADMIN_TOKEN: ADMIN_TOKEN,
        APP_UPLOAD_DIR: UPLOAD_DIR,
        APP_PUBLIC_URL: API_URL,
        // The public-read rate limiter buckets by client IP, and every spec in
        // this suite shares one — 127.0.0.1 — the same way a real venue's
        // devices can share one NAT'd address. 49 sequential specs reloading
        // the catalog/settings on every landing-page visit blow past a
        // limit sized for one legitimate device well within a run, so the
        // suite raises it rather than fighting it; the 429 path itself is
        // covered by internal/httpapi/ratelimit_test.go, not by the browser.
        APP_RATE_LIMIT_PER_MINUTE: "6000",
        APP_RATE_LIMIT_BURST: "200",
      },
    },
    {
      command: `npx vite --port ${WEB_PORT} --host 127.0.0.1 --strictPort apps/player`,
      cwd: "../frontend",
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_API_BASE_URL: API_URL },
    },
    // The admin app. It was left out of this list for as long as the suite only
    // covered the player, and that gap had a cost worth naming: the claims
    // panel, the awards panel and the settings panels had NO browser coverage
    // of any kind, and the runtime palette's one action — writing a custom
    // property to documentElement — is not reachable from any other layer.
    // Adding it here is what makes those testable; see tests/admin-*.spec.ts.
    {
      command: `npx vite --port ${ADMIN_PORT} --host 127.0.0.1 --strictPort apps/admin`,
      cwd: "../frontend",
      url: ADMIN_URL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_API_BASE_URL: API_URL, VITE_PLAYER_BASE_URL: WEB_URL },
    },
  ],
});
