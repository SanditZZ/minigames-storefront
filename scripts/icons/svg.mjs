// CALCULATIONS layer: turning an icon description into SVG markup.
//
// Pure string building — no filesystem, no browser, no randomness. The same
// arguments always produce byte-identical markup, which is what makes the
// generated PNGs reproducible and a re-run a no-op in `git status`.

import { GLYPH_PATH, GLYPH_VIEWBOX } from "./source.mjs";

/** Corner radius as a fraction of the icon's side. */
const RADIUS_RATIO = 0.22;

/**
 * Centres the glyph in a square canvas at the given scale.
 *
 * Returns the SVG transform that maps the 24×24 authoring grid onto a box of
 * `scale × size`, centred. Kept separate so the maskable safe-area check below
 * can reason about the same numbers the renderer uses.
 */
export function glyphTransform(size, scale) {
  const box = size * scale;
  const offset = (size - box) / 2;
  return `translate(${round(offset)} ${round(offset)}) scale(${round(box / GLYPH_VIEWBOX)})`;
}

/**
 * Whether a glyph at this scale stays inside a maskable icon's safe zone.
 *
 * Android may clip a maskable icon to any shape inside the full square, and
 * only guarantees the centred circle of 80% diameter survives. The glyph is a
 * wide rectangle, so the binding constraint is its DIAGONAL, not its width —
 * checking the width alone would pass a scale that loses the gamepad's corners
 * on a circular launcher.
 */
export function fitsSafeZone(scale) {
  const w = (scale * 22) / GLYPH_VIEWBOX; // drawn shape spans x 1→23
  const h = (scale * 14) / GLYPH_VIEWBOX; // …and y 5→19
  return Math.hypot(w, h) <= 0.8;
}

/**
 * Renders one icon as an SVG document.
 *
 * The background is always a filled rect covering the whole canvas — never
 * transparent. A transparent app icon is composited onto whatever the platform
 * feels like (black on iOS, white in a light tab strip, the wallpaper on some
 * launchers), so the mark would lose contrast somewhere.
 */
export function iconSvg({ theme, size, scale, rounded }) {
  const radius = rounded ? round(size * RADIUS_RATIO) : 0;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<rect width="${size}" height="${size}" rx="${radius}" fill="${theme.background}"/>`,
    `<path transform="${glyphTransform(size, scale)}" fill="${theme.mark}" d="${GLYPH_PATH}"/>`,
    `</svg>`,
  ].join("");
}

/**
 * The scalable favicon shipped as-is to browsers.
 *
 * Written on a 64-unit grid rather than the render sizes above so the file
 * stays resolution-independent — this is the one icon that is not a snapshot.
 */
export function faviconSvg(theme) {
  return `${iconSvg({ theme, size: 64, scale: 0.78, rounded: true })}\n`;
}

/** Trims float noise so regenerating produces an identical file. */
function round(n) {
  return Number(n.toFixed(4));
}
