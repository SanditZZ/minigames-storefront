// CALCULATIONS layer: rendering the tokens as a Tailwind v4 @theme block.
//
// Pure string building — the generator script does the writing. Kept in the
// package rather than in scripts/ so it is unit-testable and so the CSS shape
// lives next to the values it is derived from.

import { PALETTE } from "./palette.ts";
import { MOTION, cssEasing, type MotionToken } from "./motion.ts";

const HEADER = `/* GENERATED — do not edit.
   Source: frontend/packages/tokens/src/  ·  Regenerate: node scripts/tokens/gen-theme.mjs

   Tailwind v4 turns each --color-* into utilities (bg-brand, text-ink, …) and
   each --animate-* into an animate-* class. The @keyframes these compose with
   stay in the app's own index.css: their geometry is web-only, while the
   timings below are shared with the native apps. */`;

/** One `--animate-*` declaration. */
function animateValue(token: MotionToken): string {
  const iterations = token.iterations === "infinite" ? " infinite" : "";
  const fill = token.fill === "none" ? "" : ` ${token.fill}`;
  const seconds = token.durationMs >= 1000 ? `${token.durationMs / 1000}s` : `${token.durationMs}ms`;
  return `${token.keyframes} ${seconds} ${cssEasing(token.easing)}${iterations}${fill}`;
}

/**
 * The full @theme block for an app.
 *
 * `motion` is false for the admin app: it has no animation kit, and emitting
 * eight unused --animate-* vars there would invite someone to use one without
 * the matching @keyframes existing.
 */
export function themeCss({ motion }: { motion: boolean }): string {
  const lines: string[] = [HEADER, "", "@theme {"];

  for (const [key, token] of Object.entries(PALETTE)) {
    lines.push(`  --color-${key}: ${token.value.toLowerCase()}; /* ${token.name} — ${token.role} */`);
  }

  if (motion) {
    lines.push("");
    for (const [key, token] of Object.entries(MOTION)) {
      lines.push(`  --animate-${key}: ${animateValue(token)};`);
    }
  }

  lines.push("}", "");
  return lines.join("\n");
}
