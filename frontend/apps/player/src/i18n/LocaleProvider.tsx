// ACTIONS layer: the browser-facing half of the app's language support.
//
// Everything about WHAT a language is — the dictionaries, the lookup, the
// precedence rule — lives in @minigames/player-core and is pure. This file
// holds only the three things that need a browser or React: reading
// `navigator.languages`, keeping `<html lang>` in sync, and handing the
// resolved translator down the tree.
//
// It is the same split as `router/`: a pure grammar in the package, a thin
// binding in the app. A React Native player app replaces this file and reuses
// everything behind it.
//
// A context rather than props, for two reasons. Nearly every component renders
// at least one string, so threading `t` by hand would touch every signature in
// the app to say the same thing. And the API client depends on the locale too —
// the backend serves game names and error messages in it — so the same provider
// hands out the client, which is what stops a screen fetching in one language
// while it renders in another.

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import type { ApiClient } from "@minigames/api-client";
import {
  DEFAULT_LOCALE,
  parseLang,
  pickLocale,
  translator,
  type Locale,
  type Translator,
} from "@minigames/player-core";
import { apiFor } from "../api";

interface LocaleContextValue {
  /** The language actually being rendered, pin and device already resolved. */
  locale: Locale;
  /** Whether that language was pinned by ?lang= rather than read off the device. */
  pinned: boolean;
  /** Looks up a message in the current language. */
  t: Translator;
  /** An API client that asks the backend for this same language. */
  api: ApiClient;
}

// The default exists so a component rendered outside the provider — a test, a
// storybook-style harness — falls back to English rather than throwing. It is
// never what the running app uses.
const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  pinned: false,
  t: translator(DEFAULT_LOCALE),
  api: apiFor(DEFAULT_LOCALE),
});

/** The device's preferred languages, most-wanted first. */
function deviceLanguages(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  return navigator.languages ?? (navigator.language ? [navigator.language] : []);
}

/**
 * Claims the document's language BEFORE React mounts.
 *
 * `index.html` ships `lang="en"` because a served document has to say
 * something, and it is the one string in this app that cannot follow the
 * device: it is written at build time, and this app has no server render to
 * decide it per request. Left to the provider's effect, a Thai device would
 * therefore spend its first frame declared as English — long enough for a
 * screen reader to start in the wrong voice and for the first paint to break
 * Thai lines on spaces that are not there.
 *
 * Called from `main.tsx` on the same synchronous turn as `createRoot`, so the
 * attribute is right before anything is painted. It re-derives the locale from
 * the URL rather than taking the router's answer because the router does not
 * exist yet — the same pure `parseLang`/`pickLocale` pair the provider uses, so
 * the two cannot disagree.
 */
export function claimDocumentLang(): void {
  document.documentElement.lang = pickLocale(
    parseLang(window.location.search),
    deviceLanguages(),
  );
}

/**
 * Resolves the language once, at the top of the tree, from the pin in the URL
 * and the device's own preferences.
 *
 * `pinned` comes from the router, so the language is addressable like every
 * other piece of this app's state: a kiosk link can carry it, a reload keeps
 * it, and switching language is a navigation rather than a hidden setting.
 */
export function LocaleProvider({
  pinned,
  children,
}: {
  pinned: Locale | null;
  children: ReactNode;
}) {
  const locale = useMemo(() => pickLocale(pinned, deviceLanguages()), [pinned]);

  // The document's own language attribute. Not decoration: it is what tells a
  // screen reader which voice to read the page in, and what lets the browser
  // pick Thai line-breaking — which matters more here than in most apps, since
  // Thai has no spaces between words and breaks on dictionary boundaries.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      pinned: pinned !== null,
      t: translator(locale),
      api: apiFor(locale),
    }),
    [locale, pinned],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** Everything about the current language, for the rare component that needs more than `t`. */
export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}

/** The translator, which is all most components want. */
export function useT(): Translator {
  return useContext(LocaleContext).t;
}

/**
 * The API client for the current language.
 *
 * Every player-facing fetch goes through this rather than a module singleton,
 * because half of what the API returns is text: game names, score units and the
 * error a failed round produces are all decided server-side (see
 * backend/internal/i18n). A screen that imported a fixed client would render a
 * Thai page around an English game name.
 */
export function useApi(): ApiClient {
  return useContext(LocaleContext).api;
}
