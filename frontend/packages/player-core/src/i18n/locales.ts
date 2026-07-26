// DATA layer: which languages the player app speaks, and where the choice is
// kept. No logic — the parsing and precedence rules live in ./translate.

import { LANG_PARAM } from "@minigames/api-client";

/**
 * A language the player app is written in. A closed union on purpose: adding a
 * locale means adding its column to the dictionary, and the type is what makes
 * a half-added one fail `npm run typecheck` instead of shipping English holes.
 */
export type Locale = "en" | "th";

/** Every locale, in the order the switcher offers them. */
export const LOCALES: readonly Locale[] = ["en", "th"];

/**
 * The language used when nothing else has been decided — an unrecognised
 * `?lang=`, a device whose languages we do not speak, or no device at all.
 */
export const DEFAULT_LOCALE: Locale = "en";

/**
 * Query-string key that PINS the language, re-exported from the wire contract
 * so the app's own URL and the API request it produces cannot drift apart.
 *
 * It is a pin rather than a preference: absent means "follow the device", which
 * is why Location.lang is nullable and why an unpinned locale is never written
 * back into the URL (see the repo's rule that a parameter at its default value
 * stays out of the URL).
 *
 * Pinning has to exist because the device is the wrong authority in the case
 * this app is built for: a till-side phone runs one OS language and serves
 * whoever walks up to it.
 */
export { LANG_PARAM };

/**
 * How each language names ITSELF — the one rule a language switcher must not
 * break. A Thai speaker looking for their language scans for "ไทย"; a control
 * that says "Thai" is only readable by someone who already reads English, which
 * is precisely the person who does not need it.
 */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  th: "ไทย",
};

/** The 2–3 character form used on the compact switcher in the header. */
export const LOCALE_SHORT_NAMES: Record<Locale, string> = {
  en: "EN",
  th: "ไทย",
};
