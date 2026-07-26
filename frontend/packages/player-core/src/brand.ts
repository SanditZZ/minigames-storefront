// The storefront's identity: the fallback strings, and the pure reader that
// turns the backend's public settings into them.
//
// Note the division of labour once this app became bilingual: the FALLBACK is
// translated (it is the app's own voice, so `defaultIdentity` takes a
// translator), while a name an operator actually typed is served verbatim in
// every language. Translating admin free text would need a second column in the
// settings table, which is the same schema decision the awards face — filed in
// docs/potential-features.md rather than half-done here.
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

import { STORE_LOGO_KEY, STORE_NAME_KEY, STORE_TAGLINE_KEY } from "@minigames/api-client";
import type { Translator } from "./i18n";

export { STORE_LOGO_KEY, STORE_NAME_KEY, STORE_TAGLINE_KEY };

/** The player-facing identity of the store, resolved and ready to render. */
export interface StoreIdentity {
  name: string;
  tagline: string;
  /** Absolute URL of the store's logo, or "" when there is none. */
  logoUrl: string;
}

/**
 * What the app shows before the first fetch resolves, and if it never does.
 *
 * A function of the translator rather than a constant, because the fallback is
 * CHROME even though what it stands in for is data: an operator who never set a
 * name has not chosen an English one, so a Thai storefront with an unreachable
 * API should read as a Thai storefront. The moment a name IS configured it
 * wins in every language — an operator's own words are never translated.
 */
export function defaultIdentity(t: Translator): StoreIdentity {
  return {
    name: t("brand.name"),
    tagline: t("brand.tagline"),
    // No default logo, deliberately: the wordmark IS the fallback, and shipping
    // a stock logo would put someone else's mark on an unconfigured storefront.
    logoUrl: "",
  };
}

/**
 * storeIdentity resolves the public settings map into the strings the header
 * renders, falling back per-field rather than all-or-nothing: an operator who
 * has set a name but cleared the tagline gets their name and the stock tagline,
 * not the stock pair.
 *
 * Blank and whitespace-only values are treated as unset. An admin who empties
 * the box means "use the default", and the alternative — an empty header —
 * looks like a broken deploy rather than a choice.
 *
 * The fallback is passed IN rather than read from a constant, which is what
 * keeps this pure once the defaults became language-dependent: build it with
 * `defaultIdentity(t)` at the call site.
 */
export function storeIdentity(
  settings: Record<string, string> | null | undefined,
  fallback: StoreIdentity,
): StoreIdentity {
  return {
    name: pick(settings?.[STORE_NAME_KEY], fallback.name),
    tagline: pick(settings?.[STORE_TAGLINE_KEY], fallback.tagline),
    logoUrl: pick(settings?.[STORE_LOGO_KEY], fallback.logoUrl),
  };
}

function pick(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? fallback : trimmed;
}
