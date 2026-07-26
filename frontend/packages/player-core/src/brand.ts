// The storefront's identity: the fallback strings, and the pure reader that
// turns the backend's public settings into them.
//
// Identity used to be compile-time data — renaming the shop meant editing this
// file and redeploying, which is fine for one store and absurd for two. It is
// now an admin setting served by GET /api/v1/settings/public. The constants
// below survive as the FALLBACK, not the source: a kiosk whose API is
// unreachable still renders a name instead of an empty header.
//
// The keys themselves live in @minigames/api-client, with the rest of the wire
// contract — the admin edits the same two settings this reads, and a key
// spelled two ways is a bug that typechecks. `settings.IsPublic` on the Go side
// is what decides they may be read without a token.

import { STORE_NAME_KEY, STORE_TAGLINE_KEY } from "@minigames/api-client";

export { STORE_NAME_KEY, STORE_TAGLINE_KEY };

/** Store name shown to players when the backend has not been asked yet. */
export const BRAND_NAME = "Fun Store";

/** Short line under the brand on the landing screen. */
export const BRAND_TAGLINE = "Thanks for shopping with us — try your luck!";

/** The player-facing identity of the store, resolved and ready to render. */
export interface StoreIdentity {
  name: string;
  tagline: string;
}

/** What the app shows before the first fetch resolves, and if it never does. */
export const DEFAULT_IDENTITY: StoreIdentity = {
  name: BRAND_NAME,
  tagline: BRAND_TAGLINE,
};

/**
 * storeIdentity resolves the public settings map into the strings the header
 * renders, falling back per-field rather than all-or-nothing: an operator who
 * has set a name but cleared the tagline gets their name and the stock tagline,
 * not the stock pair.
 *
 * Blank and whitespace-only values are treated as unset. An admin who empties
 * the box means "use the default", and the alternative — an empty header —
 * looks like a broken deploy rather than a choice.
 */
export function storeIdentity(
  settings: Record<string, string> | null | undefined,
): StoreIdentity {
  return {
    name: pick(settings?.[STORE_NAME_KEY], DEFAULT_IDENTITY.name),
    tagline: pick(settings?.[STORE_TAGLINE_KEY], DEFAULT_IDENTITY.tagline),
  };
}

function pick(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? fallback : trimmed;
}
