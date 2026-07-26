// CALCULATIONS layer: turning a locale and a key into a string, and deciding
// which locale that is. Pure — no `navigator`, no `document`, no storage. The
// device's languages are passed IN, for the same reason the reveal's randomness
// is: a function that reads the environment cannot be tested, and cannot run on
// a platform that has no such environment to read.

import { en, type MessageKey, type Messages } from "./en";
import { DEFAULT_LOCALE, LOCALES, LANG_PARAM, type Locale } from "./locales";
import { th } from "./th";

/** Every dictionary, keyed by locale. */
const DICTIONARIES: Record<Locale, Messages> = { en, th };

/** Values a message may interpolate. Numbers are stringified, never formatted —
 *  a score is a score in both languages, and locale-aware number formatting is
 *  a decision for the component that has the value, not for the dictionary. */
export type MessageVars = Record<string, string | number>;

/** Looks up and fills one message. */
export type Translator = (key: MessageKey, vars?: MessageVars) => string;

/**
 * Replaces every `{name}` in a template with its value.
 *
 * A placeholder with no matching variable is left in the template rather than
 * blanked, so a missing value shows up as `{name}` on screen — visibly wrong in
 * a screenshot instead of an invisible gap in a sentence.
 */
export function format(template: string, vars?: MessageVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/**
 * The translator for a locale.
 *
 * Falls back to English per KEY rather than per locale, which is what keeps a
 * partly-written dictionary from reverting a whole screen: the one untranslated
 * line shows in English and everything around it stays translated, so the hole
 * is obvious and small. (The type system makes this unreachable for the two
 * locales that ship — `Messages` is a complete record — but the fallback is
 * what the runtime does if a dictionary is ever loaded rather than compiled in.)
 */
export function translator(locale: Locale): Translator {
  const dict = DICTIONARIES[locale] ?? en;
  return (key, vars) => format(dict[key] ?? en[key] ?? key, vars);
}

/**
 * Parses a raw language tag into a Locale, or null when it is not one we speak.
 *
 * Null rather than DEFAULT_LOCALE on purpose: "absent or unrecognised" and
 * "explicitly English" are different states. Only the first should fall through
 * to the device's own languages — see pickLocale — and only the second should
 * be written back into the URL.
 */
export function parseLocale(raw: string | null | undefined): Locale | null {
  const tag = (raw ?? "").trim().toLowerCase();
  if (!tag) return null;
  // language[-region]: there is one Thai translation, not one per region.
  const base = tag.split(/[-_]/)[0];
  return (LOCALES as readonly string[]).includes(base) ? (base as Locale) : null;
}

/** Reads the pinned locale out of a query string, or null when unpinned. */
export function parseLang(search: string): Locale | null {
  return parseLocale(new URLSearchParams(search).get(LANG_PARAM));
}

/**
 * The locale to render in, and the one place the precedence rule lives:
 *
 *   ?lang=  →  the device's languages  →  DEFAULT_LOCALE
 *
 * The pin wins because it is the one a person chose. The case that decides this
 * is the app's whole reason for existing: a till-side phone runs one OS
 * language and serves whoever walks up to it, so the customer's language has to
 * be settable without touching the phone's settings — and a `?lang=th` link has
 * to keep meaning Thai on whatever device opens it.
 *
 * `preferred` is `navigator.languages` passed in by the caller. The first entry
 * we speak wins; browsers list them in preference order.
 *
 * Mirrors i18n.Negotiate on the Go side. The two are separate implementations
 * of one rule, which is fine as long as they stay one rule: the client sends
 * the locale it resolved as `?lang=`, so the server never has to guess and the
 * two cannot disagree about a given request.
 */
export function pickLocale(
  pinned: Locale | null | undefined,
  preferred: readonly string[] = [],
): Locale {
  if (pinned) return pinned;
  for (const tag of preferred) {
    const locale = parseLocale(tag);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}
