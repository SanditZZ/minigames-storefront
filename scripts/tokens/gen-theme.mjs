// ACTIONS layer: write the generated theme artifacts to disk.
//
//   npm run theme        (in frontend/)   # rewrite the generated files
//   npm run theme:check  (in frontend/)   # fail if any of them drifted
//
// Same shape as scripts/icons/: a pure module decides the content, this file
// only writes it. Every output is COMMITTED, so no build step depends on
// running this — Vite reads a plain .css file and Metro a plain .json, exactly
// as they would if the values had been typed by hand.
//
// Two outputs, because the two platforms cannot read the same file:
//
//   frontend/apps/*/src/theme.css        Tailwind v4 @theme block (web)
//   frontend/packages/tokens/colors.json plain map (NativeWind / anything else)
//
// The JSON exists because NativeWind 4 pins Tailwind v3, whose config is loaded
// by Node — so a mobile tailwind.config.js cannot import the TypeScript source
// the way the web build can. Emitting a dumb JSON map keeps palette.ts the
// single source without asking every consumer to bring a TS loader.
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
const TOKENS = join(REPO, "frontend", "packages", "tokens");

// Imported by path rather than by package name: this script lives at the repo
// root, outside the frontend workspace where @minigames/tokens is linked.
const { themeCss } = await import(pathToFileURL(join(TOKENS, "src", "theme.ts")).href);
const { COLORS } = await import(pathToFileURL(join(TOKENS, "src", "palette.ts")).href);

/** Only the player has an animation kit; see themeCss's `motion` flag. */
const WEB_APPS = [
  { app: "player", motion: true },
  { app: "admin", motion: false },
];

const checkOnly = process.argv.includes("--check");
const drift = [];

/** Writes a file, or records drift when running under --check. */
async function emit(path, content) {
  const current = await readFile(path, "utf8").catch(() => null);
  if (current === content) return;
  if (checkOnly) {
    drift.push(path.replace(`${REPO}/`, ""));
    return;
  }
  await writeFile(path, content);
}

for (const { app, motion } of WEB_APPS) {
  await emit(join(REPO, "frontend", "apps", app, "src", "theme.css"), themeCss({ motion }));
}

await emit(join(TOKENS, "colors.json"), `${JSON.stringify(COLORS, null, 2)}\n`);

if (checkOnly && drift.length) {
  console.error(`✗ ${drift.length} generated file(s) out of date:\n  ${drift.join("\n  ")}`);
  console.error("  Run: npm run theme  (in frontend/)");
  process.exit(1);
}
console.log(checkOnly ? "✓ Generated theme files match their tokens." : "✓ Theme files written.");
