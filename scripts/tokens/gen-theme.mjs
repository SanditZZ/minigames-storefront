// ACTIONS layer: write each web app's generated @theme block to disk.
//
//   npm run theme        (in frontend/)   # rewrite apps/*/src/theme.css
//   npm run theme:check  (in frontend/)   # fail if the committed CSS drifted
//
// Same shape as scripts/icons/: a pure module decides the content, this file
// only writes it. The output is COMMITTED, so no build step depends on running
// this — Vite reads a plain .css file exactly as it always did.
//
// Node 22 needs --experimental-strip-types to import the TypeScript source,
// which in turn requires explicit .ts extensions; that is why the tokens
// package spells its own imports that way and nothing else in the repo does.
// The npm scripts above carry the flags so nobody has to remember them.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");

// Imported by path rather than by package name: this script lives at the repo
// root, outside the frontend workspace where @minigames/tokens is linked.
const { themeCss } = await import(
  pathToFileURL(join(REPO, "frontend", "packages", "tokens", "src", "theme.ts")).href
);

/** Only the player has an animation kit; see themeCss's `motion` flag. */
const APPS = [
  { app: "player", motion: true },
  { app: "admin", motion: false },
];

const checkOnly = process.argv.includes("--check");
const drift = [];

for (const { app, motion } of APPS) {
  const path = join(REPO, "frontend", "apps", app, "src", "theme.css");
  const next = themeCss({ motion });
  const current = await readFile(path, "utf8").catch(() => null);
  if (current === next) continue;
  if (checkOnly) {
    drift.push(path.replace(`${REPO}/`, ""));
    continue;
  }
  await writeFile(path, next);
}

if (checkOnly && drift.length) {
  console.error(`✗ ${drift.length} theme file(s) out of date:\n  ${drift.join("\n  ")}`);
  console.error("  Run: node scripts/tokens/gen-theme.mjs");
  process.exit(1);
}
console.log(checkOnly ? "✓ Themes match their tokens." : "✓ Themes written.");
