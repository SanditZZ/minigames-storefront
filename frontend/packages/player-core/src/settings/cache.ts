// DATA + CALCULATIONS: how the storefront's public settings are remembered
// between visits, and the rules for reading a remembered copy back.
//
// The settings arrive from `GET /api/v1/settings/public` on mount, which means
// the first frame of a cold load is drawn from the built-in defaults and the
// second from the store's own identity. That is a repaint for the palette and
// the wordmark, and a LAYOUT SHIFT for the cover banner — a 3:1 band appearing
// at the top of the landing screen shoves the game list down under a thumb that
// was already reaching for it. Remembering the last answer removes all three,
// because a returning kiosk knows what the store looks like before it asks.
//
// Pure and in the package on purpose: WHERE the copy is kept is per-platform
// (`localStorage` on the web, `AsyncStorage` on a phone) but what a valid copy
// looks like is not, and neither is the decision to distrust one. The web half
// is `apps/player/src/state/settingsCache.ts` and it is about ten lines.
//
// ## The remembered copy is untrusted input
//
// Anything can be in a browser's storage: a half-written string from a tab
// killed mid-write, a value left by an older version of this app, or something
// a person typed into their own console. `decodeSettings` therefore treats it
// like a wire response rather than like state it wrote itself — a blob that is
// not a flat map of strings is not a cache, it is nothing, and the app falls
// back to the defaults it would have used anyway. Nothing here can be worse
// than the first paint already was.

import type { PublicSettings } from "@minigames/api-client";

/**
 * Where the remembered copy lives.
 *
 * Versioned in the name rather than in the payload, so the day this stops being
 * a flat string map the old copies are simply never read again — no migration,
 * no decoder that has to understand two shapes. Storage is per-origin, so two
 * storefronts served from different hosts cannot see each other's copy.
 */
export const SETTINGS_CACHE_KEY = "minigames.player.settings.v1";

/** The copy to store. Every value is already a string — this is the wire shape. */
export function encodeSettings(settings: PublicSettings): string {
  return JSON.stringify(settings);
}

/**
 * Reads a remembered copy back, or `null` when there is not a usable one.
 *
 * `null` and `{}` are different answers and both are meaningful: `null` is "no
 * idea what this store looks like" (first visit, cleared storage, junk), while
 * `{}` is "asked, and the operator has configured nothing" — which is worth
 * remembering, because it is the case where the defaults are RIGHT rather than
 * merely all we have.
 *
 * Non-string values are dropped rather than failing the whole blob, matching
 * how the palette treats a malformed override: the entry is not a setting, and
 * the rest of the map is still the operator's.
 */
export function decodeSettings(raw: string | null | undefined): PublicSettings | null {
  if (raw == null || raw === "") return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  // Arrays are objects, and `typeof null` is "object" — both have to be refused
  // explicitly or a `[]` in storage decodes to an empty settings map and reads
  // as a legitimate answer.
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const settings: PublicSettings = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value === "string") settings[key] = value;
  }
  return settings;
}
