import { defineConfig } from "vitest/config";

// Unit tests cover the CALCULATION layers only — URL parsing and the reveal
// maths — so they need no DOM and no browser. Component and flow behaviour is
// covered by the Playwright suite in e2e/ instead of a jsdom simulation of it.
export default defineConfig({
  test: {
    environment: "node",
    include: ["apps/*/src/**/*.test.ts", "packages/*/src/**/*.test.ts"],
  },
});
