// DATA layer: the icon table. Geometry only — no React, no markup, no colour.
//
// Every entry is copied verbatim from Lucide (https://icones.js.org/collection/
// lucide, `lucide-static` v1.27.0) with the wrapper `<svg>` dropped and the
// shapes transcribed as objects. Nothing here is drawn, traced, or adjusted by
// hand: an icon that does not exist in the set is not an icon this project has.
//
// ## Adding one
//
// 1. Find it on https://icones.js.org/ — Lucide only. Mixing sets is what makes
//    an interface look assembled instead of designed, so a mark that Lucide
//    does not have is a prompt to pick a different mark, not a different set.
// 2. Copy its SVG and transcribe the shapes into the list below, keyed by
//    Lucide's own name. Keep the keys sorted; the file is read far more often
//    than it is edited.
// 3. Nothing else. `IconName` widens automatically, so both apps can use it and
//    the compiler starts rejecting the typo.
//
// ## Removing one
//
// An unused entry costs a few hundred bytes in every bundle that imports the
// table, since it is one object literal and nothing tree-shakes a property.
// `data.test.ts` cannot tell you which are unused — grep does.

import type { IconShape } from "./shape";

export const ICONS = {
  "bell": [
    { tag: "path", d: "M10.268 21a2 2 0 0 0 3.464 0" },
    { tag: "path", d: "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" },
  ],
  "blocks": [
    { tag: "path", d: "M10 22V7a1 1 0 0 0-1-1H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a1 1 0 0 0-1-1H2" },
    { tag: "rect", x: 14, y: 2, width: 8, height: 8, rx: 1 },
  ],
  "check": [
    { tag: "path", d: "M20 6 9 17l-5-5" },
  ],
  "clipboard": [
    { tag: "rect", width: 8, height: 4, x: 8, y: 2, rx: 1, ry: 1 },
    { tag: "path", d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" },
  ],
  "compass": [
    { tag: "circle", cx: 12, cy: 12, r: 10 },
    { tag: "path", d: "m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" },
  ],
  "crown": [
    { tag: "path", d: "M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" },
    { tag: "path", d: "M5 21h14" },
  ],
  "dumbbell": [
    { tag: "path", d: "M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z" },
    { tag: "path", d: "m2.5 21.5 1.4-1.4" },
    { tag: "path", d: "m20.1 3.9 1.4-1.4" },
    { tag: "path", d: "M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z" },
    { tag: "path", d: "m9.6 14.4 4.8-4.8" },
  ],
  "flag": [
    { tag: "path", d: "M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528" },
  ],
  "flame": [
    { tag: "path", d: "M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" },
  ],
  "frown": [
    { tag: "circle", cx: 12, cy: 12, r: 10 },
    { tag: "path", d: "M16 16s-1.5-2-4-2-4 2-4 2" },
    { tag: "line", x1: 9, x2: 9.01, y1: 9, y2: 9 },
    { tag: "line", x1: 15, x2: 15.01, y1: 9, y2: 9 },
  ],
  "gamepad-2": [
    { tag: "line", x1: 6, x2: 10, y1: 11, y2: 11 },
    { tag: "line", x1: 8, x2: 8, y1: 9, y2: 13 },
    { tag: "line", x1: 15, x2: 15.01, y1: 12, y2: 12 },
    { tag: "line", x1: 18, x2: 18.01, y1: 10, y2: 10 },
    { tag: "path", d: "M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" },
  ],
  "gift": [
    { tag: "path", d: "M12 7v14" },
    { tag: "path", d: "M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8" },
    { tag: "path", d: "M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5" },
    { tag: "rect", x: 3, y: 7, width: 18, height: 4, rx: 1 },
  ],
  "image": [
    { tag: "rect", width: 18, height: 18, x: 3, y: 3, rx: 2, ry: 2 },
    { tag: "circle", cx: 9, cy: 9, r: 2 },
    { tag: "path", d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" },
  ],
  "party-popper": [
    { tag: "path", d: "M5.8 11.3 2 22l10.7-3.79" },
    { tag: "path", d: "M4 3h.01" },
    { tag: "path", d: "M22 8h.01" },
    { tag: "path", d: "M15 2h.01" },
    { tag: "path", d: "M22 20h.01" },
    { tag: "path", d: "m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10" },
    { tag: "path", d: "m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17" },
    { tag: "path", d: "m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7" },
    { tag: "path", d: "M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z" },
  ],
  "pointer": [
    { tag: "path", d: "M22 14a8 8 0 0 1-8 8" },
    { tag: "path", d: "M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2" },
    { tag: "path", d: "M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1" },
    { tag: "path", d: "M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10" },
    { tag: "path", d: "M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" },
  ],
  "puzzle": [
    { tag: "path", d: "M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z" },
  ],
  "rotate-cw": [
    { tag: "path", d: "M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" },
    { tag: "path", d: "M21 3v5h-5" },
  ],
  "search": [
    { tag: "path", d: "m21 21-4.34-4.34" },
    { tag: "circle", cx: 11, cy: 11, r: 8 },
  ],
  "sprout": [
    { tag: "path", d: "M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3" },
    { tag: "path", d: "M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4" },
    { tag: "path", d: "M5 21h14" },
  ],
  "star": [
    { tag: "path", d: "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" },
  ],
  "target": [
    { tag: "circle", cx: 12, cy: 12, r: 10 },
    { tag: "circle", cx: 12, cy: 12, r: 6 },
    { tag: "circle", cx: 12, cy: 12, r: 2 },
  ],
  "thumbs-up": [
    { tag: "path", d: "M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" },
    { tag: "path", d: "M7 10v12" },
  ],
  "ticket": [
    { tag: "path", d: "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" },
    { tag: "path", d: "M13 5v2" },
    { tag: "path", d: "M13 17v2" },
    { tag: "path", d: "M13 11v2" },
  ],
  "triangle-alert": [
    { tag: "path", d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" },
    { tag: "path", d: "M12 9v4" },
    { tag: "path", d: "M12 17h.01" },
  ],
  "trophy": [
    { tag: "path", d: "M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2" },
    { tag: "path", d: "M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2" },
    { tag: "path", d: "M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3" },
    { tag: "path", d: "M4 22h16" },
    { tag: "path", d: "M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z" },
    { tag: "path", d: "M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3" },
  ],
  "wifi-off": [
    { tag: "path", d: "M12 20h.01" },
    { tag: "path", d: "M8.5 16.429a5 5 0 0 1 7 0" },
    { tag: "path", d: "M5 12.859a10 10 0 0 1 5.17-2.69" },
    { tag: "path", d: "M19 12.859a10 10 0 0 0-2.007-1.523" },
    { tag: "path", d: "M2 8.82a15 15 0 0 1 4.177-2.643" },
    { tag: "path", d: "M22 8.82a15 15 0 0 0-11.288-3.764" },
    { tag: "path", d: "m2 2 20 20" },
  ],
  "zap": [
    { tag: "path", d: "M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z" },
  ],
} as const satisfies Record<string, readonly IconShape[]>;

/**
 * Every icon this project has, as a type.
 *
 * Deriving it from the table rather than writing it out is what makes an icon
 * prop safe to type: `icon="giftt"` fails `npm run typecheck` instead of
 * rendering an empty box that nobody notices until a screenshot.
 */
export type IconName = keyof typeof ICONS;

/** The table's keys, for tests and tooling. Not for rendering a picker. */
export const ICON_NAMES = Object.keys(ICONS) as IconName[];
