// CALCULATIONS layer: resolving an admin-configured palette against the tokens.
//
// # Which source of colour wins
//
// There are now two: `PALETTE` in palette.ts, which is compiled into each app's
// theme.css, and the operator's `color_*` settings, read at runtime. The rule,
// in one line:
//
//   **The tokens are the palette. A setting that is present AND a valid colour
//   overrides one of them. Anything else — absent, blank, malformed — is not an
//   override and the token stands.**
//
// The asymmetry is deliberate. Colour settings are NOT seeded, so a store that
// has never opted out follows the tokens, which means editing palette.ts still
// re-themes every such store. Seeding them would have inverted that: every
// database would pin the palette at whatever it was on the day it was created,
// and a token change would silently reach nobody. `theme:check` guards the
// tokens; nothing can guard a value an operator has copied into a database.
//
// The consequence to hold onto: an operator who sets a colour has opted out of
// future token changes for that colour until they clear it. That is what
// "override" means, and it is why the admin offers a reset rather than only an
// edit box.

import { PALETTE, type ColorName } from "./palette.ts";

/**
 * Setting key per palette entry. `brand-2` becomes `color_brand_2` — settings
 * keys are snake_case throughout (`claim_ttl_hours`, `store_name`), and a
 * hyphen in a key would be the only one in the table.
 */
export const COLOR_SETTING_KEYS = {
  brand: "color_brand",
  "brand-2": "color_brand_2",
  "brand-3": "color_brand_3",
  "brand-4": "color_brand_4",
  ink: "color_ink",
} as const satisfies Record<ColorName, string>;

/** Every colour setting key, for the backend allowlist and the admin form. */
export const COLOR_SETTING_KEY_LIST: string[] = Object.values(COLOR_SETTING_KEYS);

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * isHexColor accepts `#abc` and `#aabbcc`, case-insensitively, and nothing else.
 *
 * Deliberately narrow. CSS would happily take `red`, `rgb(…)`, or
 * `var(--anything)`, and the last of those is the problem: these values are
 * written into a CSS custom property on the document, so accepting arbitrary CSS
 * would let an admin-set string reach the style engine intact. A hex literal
 * cannot express anything but a colour. The same check runs server-side at
 * write time (internal/settings.IsHexColor) — this copy is what lets the admin
 * form say so before submitting.
 */
export function isHexColor(value: string): boolean {
  return HEX.test(value.trim());
}

/** Lowercased hex if the value is one, otherwise null. */
export function normalizeHex(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return isHexColor(trimmed) ? trimmed.toLowerCase() : null;
}

/**
 * The overrides an operator has actually set: only keys that are present and
 * valid. An entry missing from the result means "use the token", which is what
 * lets a caller tell an explicit choice from a default without comparing hexes.
 */
export function paletteOverrides(
  settings: Record<string, string> | null | undefined,
): Partial<Record<ColorName, string>> {
  const out: Partial<Record<ColorName, string>> = {};
  if (!settings) return out;

  for (const [name, key] of Object.entries(COLOR_SETTING_KEYS) as [ColorName, string][]) {
    const hex = normalizeHex(settings[key]);
    if (hex) out[name] = hex;
  }
  return out;
}

/**
 * The palette to actually render with: tokens, with any valid override applied.
 *
 * Pure and platform-free, so the React Native clients resolve their palette the
 * same way the web does rather than reimplementing the precedence rule.
 */
export function resolvePalette(
  settings: Record<string, string> | null | undefined,
): Record<ColorName, string> {
  const overrides = paletteOverrides(settings);
  const out = {} as Record<ColorName, string>;

  for (const [name, token] of Object.entries(PALETTE) as [ColorName, { value: string }][]) {
    out[name] = overrides[name] ?? token.value.toLowerCase();
  }
  return out;
}

/**
 * The CSS custom properties to set on the document, as [property, value] pairs
 * — the same `--color-*` names the generated @theme block declares, which is
 * what makes an override land: Tailwind v4 compiles `bg-brand` to
 * `background-color: var(--color-brand)`, so redefining the variable
 * re-colours every utility built on it.
 *
 * Only OVERRIDDEN colours appear. Writing all five would be harmless but would
 * pin the palette at whatever this bundle was built with, defeating the point
 * of leaving unset colours to the tokens.
 *
 * Building the list here rather than in the app keeps the one place that knows
 * the variable-naming convention next to the one that generates it.
 */
export function paletteCssVars(
  settings: Record<string, string> | null | undefined,
): [property: string, value: string][] {
  return Object.entries(paletteOverrides(settings)).map(([name, hex]) => [`--color-${name}`, hex]);
}
