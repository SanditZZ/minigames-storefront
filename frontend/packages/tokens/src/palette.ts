// DATA layer: the brand palette, as values rather than CSS.
//
// This is THE source of the five colours. `frontend/CLAUDE.md` has always said
// "re-theme by editing five vars"; until now those vars lived in each app's
// index.css, which meant they were only readable by something that parses CSS.
// React Native has no stylesheet at all — styles are plain JS objects — so a
// palette locked inside a .css file cannot follow the apps onto a phone.
//
// Holding the values here inverts that: the CSS is GENERATED from this file
// (scripts/tokens/gen-theme.mjs), and a native app imports the same constants
// directly. One edit still re-themes everything; "everything" just got bigger.

/** A palette entry: the value plus what it is allowed to be used for. */
export interface Token {
  value: string;
  /** Human name used in generated comments and design conversation. */
  name: string;
  /** The role from frontend/CLAUDE.md. Kept with the value so the rule travels. */
  role: string;
}

/**
 * The five brand colours. Keys match the Tailwind token names exactly
 * (`brand` → `bg-brand`, `ink` → `text-ink`), so a class name on the web and a
 * lookup in native code refer to the same entry by the same word.
 */
export const PALETTE = {
  brand: {
    value: "#FF9A86",
    name: "Coral",
    role: "Primary actions/CTAs, key accents, progress & timer fills, active states, focus rings",
  },
  "brand-2": {
    value: "#FFB399",
    name: "Melon",
    role: "Secondary accents, hover states, gradient mid-stop",
  },
  "brand-3": {
    value: "#FFD6A6",
    name: "Apricot",
    role: "Muted surfaces, subtle backgrounds, gradient stop",
  },
  "brand-4": {
    value: "#FFF0BE",
    name: "Cream",
    role: "App background base, lightest surfaces",
  },
  ink: {
    value: "#4A2B20",
    name: "Ink",
    role: "ALL text and icons on light surfaces",
  },
} as const satisfies Record<string, Token>;

export type ColorName = keyof typeof PALETTE;

/**
 * Bare hex values, for code that just wants a colour.
 *
 * React Native's StyleSheet takes a string, not a token object; this is the
 * shape it wants. Web code should keep using the Tailwind class names — reading
 * `COLORS.brand` into an inline style there would route around the palette
 * rules rather than follow them.
 */
export const COLORS = Object.fromEntries(
  Object.entries(PALETTE).map(([key, token]) => [key, token.value]),
) as Record<ColorName, string>;
