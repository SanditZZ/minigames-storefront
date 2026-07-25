import { defineConfig, devices } from "@playwright/test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The suite runs against its OWN stack — a throwaway SQLite file and dedicated
// ports — never the deployed one under .prod/. Test rounds must not land on the
// real leaderboard or burn real prize stock.
const API_PORT = 8299;
const WEB_PORT = 5299;
const API_URL = `http://127.0.0.1:${API_PORT}`;
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
const DB_PATH = join(tmpdir(), "minigames-e2e.db");

// Start from an empty database every run: leftover scores would change ranks and
// silently invalidate assertions about being top of the board.
for (const suffix of ["", "-wal", "-shm"]) {
  rmSync(`${DB_PATH}${suffix}`, { force: true });
}

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
        APP_CORS_ORIGINS: WEB_URL,
        APP_ADMIN_TOKEN: "admin",
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
  ],
});
