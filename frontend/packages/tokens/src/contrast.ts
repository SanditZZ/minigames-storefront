// CALCULATIONS layer: is a palette legible?
//
// `frontend/CLAUDE.md` states the contrast rules the five tokens were CHOSEN to
// satisfy — ink on every light surface, never white text on the pastels — and
// `override.ts` lets an operator replace any of them with anything that parses
// as hex. Nothing connected the two: cream ink on a cream background is two
// saves away, and the only feedback is the admin repainting itself the same way.
//
// What this file computes is WCAG 2.x contrast, which is a ratio between two
// relative luminances and nothing more; it does not know about the admin, the
// draft being edited, or what to say about a failure. Callers decide.
//
// **This is a WARNING, and it must stay one.** A venue's real brand colour is
// not negotiable with a validator — refusing to save it would get the palette
// set by hand in SQLite instead, which is the same illegible store with no
// warning at all. So `lowContrastPairs` returns findings, never a verdict, and
// nothing here disables a save.

import { PALETTE, type ColorName } from "./palette.ts";
import { normalizeHex } from "./override.ts";

/**
 * WCAG AA for normal-size text. The one threshold this project checks: AAA
 * (7:1) would fail the shipped tokens, and the large-text allowance (3:1)
 * cannot be applied without knowing the font size at each call site, which is
 * exactly the thing a palette does not know.
 */
export const CONTRAST_AA_NORMAL = 4.5;

/** White is not a token — it is rule 4's card surface, so it is checked by hand. */
const WHITE = "#ffffff";

/** One side of a checked pair: a palette entry, or the white a Card is. */
export type ContrastSurface = ColorName | "white";

/** A pair that was measured, with the ratio it came out at. */
export interface ContrastPair {
  /** The colour used as TEXT. Always `ink` today — see PAIRS. */
  readonly text: ColorName;
  /** What that text sits on. */
  readonly on: ContrastSurface;
  /** WCAG contrast, 1 (identical) to 21 (black on white). */
  readonly ratio: number;
}

/**
 * The pairs the palette rules actually name, and only those.
 *
 * Rule 2 puts `ink` on everything and rule 4 makes a card white, so every
 * combination a screen can legitimately produce is ink over one of five
 * surfaces. Pairs the rules FORBID — white on a pastel — are absent on purpose:
 * measuring one would imply it is allowed at a good enough ratio, and it is not.
 */
const PAIRS: readonly { text: ColorName; on: ContrastSurface }[] = [
  { text: "ink", on: "brand" },
  { text: "ink", on: "brand-2" },
  { text: "ink", on: "brand-3" },
  { text: "ink", on: "brand-4" },
  { text: "ink", on: "white" },
];

/** sRGB channels 0–255, expanding `#abc` to `#aabbcc`. Null if not a hex. */
function channels(hex: string): [number, number, number] | null {
  const value = normalizeHex(hex);
  if (!value) return null;

  const digits =
    value.length === 4
      ? value
          .slice(1)
          .split("")
          .map((c) => c + c)
      : [value.slice(1, 3), value.slice(3, 5), value.slice(5, 7)];

  return digits.map((pair) => parseInt(pair, 16)) as [number, number, number];
}

/**
 * Relative luminance per WCAG 2.1: linearise each channel, then weight them by
 * the eye's sensitivity. The 0.03928 knee and the 2.4 exponent are the spec's
 * numbers verbatim — they are not a curve worth improving on locally, because
 * the threshold above is defined against exactly this function.
 */
function luminance([r, g, b]: [number, number, number]): number {
  const linear = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }) as [number, number, number];

  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/**
 * Contrast between two hex colours, 1–21, or null if either is not a colour.
 *
 * Null rather than a thrown error or a 1: an unparseable value here means the
 * operator is mid-type, and the caller already has `isHexColor` to say so
 * properly. Reporting it as "no contrast" would put a legibility warning on
 * screen for what is really a half-typed hex.
 */
export function contrastRatio(a: string, b: string): number | null {
  const first = channels(a);
  const second = channels(b);
  if (!first || !second) return null;

  const [light, dark] = [luminance(first), luminance(second)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Every named pair, measured against a resolved palette. */
export function paletteContrast(palette: Record<ColorName, string>): ContrastPair[] {
  const out: ContrastPair[] = [];

  for (const { text, on } of PAIRS) {
    const ratio = contrastRatio(palette[text], on === "white" ? WHITE : palette[on]);
    if (ratio !== null) out.push({ text, on, ratio });
  }
  return out;
}

/**
 * The pairs that fall below the threshold, worst first.
 *
 * Worst first because the fix is usually one colour: an `ink` nobody can read
 * fails all five rows at once, and the operator wants the biggest number to
 * chase rather than the first row of an alphabetical list.
 */
export function lowContrastPairs(
  palette: Record<ColorName, string>,
  minimum: number = CONTRAST_AA_NORMAL,
): ContrastPair[] {
  return paletteContrast(palette)
    .filter((pair) => pair.ratio < minimum)
    .sort((a, b) => a.ratio - b.ratio);
}

/** A pair's surface in words, for a message: "Coral", or "white". */
export function surfaceName(surface: ContrastSurface): string {
  return surface === "white" ? "white" : PALETTE[surface].name;
}
