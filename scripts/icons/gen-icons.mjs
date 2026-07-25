// ACTIONS layer: render the icon set to disk. All shaping lives in the pure
// modules beside this one; this file only launches a browser and writes files.
//
//   node scripts/icons/gen-icons.mjs            # rewrite public/ for both apps
//   node scripts/icons/gen-icons.mjs --check    # verify checked-in files match
//
// WHY A BROWSER: this box has no rsvg-convert, and ImageMagick falls back to
// its own MSVG renderer, which mangles the arc commands this glyph is built
// from. Chromium is already installed for the Playwright suite and rasterises
// SVG exactly as the browsers we target do, so it is the honest renderer to
// snapshot from. It is borrowed here as a dev tool only — nothing in any app
// build, or in CI, depends on this script.

import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { manifestJson } from "./manifest.mjs";
import { ICO_SIZES, RENDERS, THEMES } from "./source.mjs";
import { faviconSvg, fitsSafeZone, iconSvg } from "./svg.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const PUBLIC_DIR = (app) => join(REPO, "frontend", "apps", app, "public");

// Playwright lives in the e2e package, which is deliberately outside the
// frontend workspace; resolve it from there rather than adding a build-time
// image dependency to an app that would then ship it.
const require = createRequire(join(REPO, "e2e", "package.json"));

const checkOnly = process.argv.includes("--check");
const drift = [];

/** Orientation is locked only for the player: it is a one-handed kiosk game. */
const ORIENTATION = { player: "portrait", admin: undefined };

async function main() {
  assertSafeZones();

  const { chromium } = require("@playwright/test");
  const browser = await chromium.launch();
  try {
    for (const theme of Object.values(THEMES)) {
      await buildApp(browser, theme);
    }
  } finally {
    await browser.close();
  }

  if (checkOnly && drift.length) {
    console.error(`✗ ${drift.length} icon file(s) out of date:\n  ${drift.join("\n  ")}`);
    console.error("  Run: node scripts/icons/gen-icons.mjs");
    process.exit(1);
  }
  console.log(checkOnly ? "✓ Icons match their source." : "✓ Icons written.");
}

/**
 * Fails loudly if a maskable render would lose its corners on a round launcher.
 * Cheap arithmetic, but the failure it prevents is invisible until someone
 * installs the app on the one phone that crops hardest.
 */
function assertSafeZones() {
  for (const r of RENDERS) {
    if (r.file.includes("maskable") && !fitsSafeZone(r.scale)) {
      throw new Error(`${r.file}: scale ${r.scale} escapes the maskable safe zone`);
    }
  }
}

async function buildApp(browser, theme) {
  const dir = PUBLIC_DIR(theme.app);
  await mkdir(dir, { recursive: true });

  const page = await browser.newPage();
  try {
    for (const r of RENDERS) {
      const png = await rasterize(page, iconSvg({ theme, ...r }), r.size);
      await emit(join(dir, r.file), png);
    }
  } finally {
    await page.close();
  }

  await emit(join(dir, "favicon.svg"), Buffer.from(faviconSvg(theme)));
  await emit(join(dir, "manifest.webmanifest"), Buffer.from(manifestJson(theme, { orientation: ORIENTATION[theme.app] })));
  await buildIco(dir);
}

/**
 * Screenshots one SVG at its natural size.
 *
 * The viewport is set to the exact icon size and the page background is left
 * opaque-free: every icon paints its own full-bleed rect, so any pixel the
 * screenshot picks up from the page itself would be a bug worth seeing rather
 * than one to paper over with a background colour here.
 */
async function rasterize(page, svg, size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;padding:0}</style>${svg}`);
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

/**
 * Assembles the legacy .ico from PNGs already on disk.
 *
 * ImageMagick reads PNG reliably — it is only its SVG path that is unusable
 * here — so this stays a shell-out rather than a hand-rolled ICO writer.
 */
async function buildIco(dir) {
  const inputs = ICO_SIZES.map((s) => join(dir, `favicon-${s}.png`));
  const target = join(dir, "favicon.ico");
  const tmp = join(dir, ".favicon.tmp.ico");
  execFileSync("convert", [...inputs, tmp]);
  const built = await readFile(tmp);
  await execFileSync("rm", ["-f", tmp]);
  await emit(target, built);
}

/** Writes a file, or records drift when running under --check. */
async function emit(path, buffer) {
  const existing = await readFile(path).catch(() => null);
  if (existing && existing.equals(buffer)) return;
  if (checkOnly) {
    drift.push(path.replace(`${REPO}/`, ""));
    return;
  }
  await writeFile(path, buffer);
}

await main();
