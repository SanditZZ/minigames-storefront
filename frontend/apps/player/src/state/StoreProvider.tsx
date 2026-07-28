// ACTIONS layer: the storefront's identity, resolved once and handed down.
//
// Everything about WHAT the settings mean stays pure and shared — `storeIdentity`
// and `defaultIdentity` in @minigames/player-core decide the per-field fallback,
// `paletteCssVars` in @minigames/tokens decides the colours. This file holds only
// the three things that need React or a browser: fetching, applying the palette
// to the document, and distributing the answer.
//
// A context rather than props, and the reason is the one the roadmap kept
// filing: the identity is a property of the APP, not of the landing screen.
// `usePublicSettings` used to be called in App.tsx and its answer passed to
// HomeScreen alone, so every later feature that wanted the store's identity
// somewhere else — the result screen's own header, the cover banner (which is
// not rendered by a screen at all: it lives in the layout, outside the padded
// column), the shareable score card still to come — had to either re-thread the
// prop through screens that do not use it or refetch. Threading state through
// components that only forward it is how
// a small change becomes a tangled one; the language support next door already
// settled the same argument the same way (see LocaleProvider).
//
// This sits INSIDE LocaleProvider, and must: the fallback name is translated —
// an operator who never set one has not chosen an English one — so resolving the
// identity needs a translator that has already been resolved itself.

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  DEFAULT_LOCALE,
  defaultIdentity,
  storeIdentity,
  translator,
  type StoreIdentity,
} from "@minigames/player-core";
import { useT } from "../i18n";
import { useBrandPalette } from "../theme/useBrandPalette";
import { usePublicSettings } from "./usePublicSettings";

interface StoreContextValue {
  /** The store's name, tagline and logo, fallbacks already applied per field. */
  identity: StoreIdentity;
  /** Re-reads the settings. The kiosk-phone reload gesture ends up here. */
  refresh: () => void;
  refreshing: boolean;
}

// The default exists so a component rendered outside the provider falls back to
// the built-in identity rather than throwing — the same reason LocaleContext has
// one. It is never what the running app uses.
const StoreContext = createContext<StoreContextValue>({
  identity: defaultIdentity(translator(DEFAULT_LOCALE)),
  refresh: () => {},
  refreshing: false,
});

/**
 * Resolves the store's identity once, at the top of the tree.
 *
 * The palette is applied from here rather than passed down for the same reason
 * the identity is no longer a prop: a game's timer fill and the result screen's
 * meter are both `bg-brand`, and neither should have to know the store has
 * repainted itself.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const { settings, refresh, refreshing } = usePublicSettings();

  useBrandPalette(settings);

  // Only the FALLBACK follows the language: a name an operator actually typed is
  // served verbatim in both — see the note at the top of brand.ts.
  const value = useMemo<StoreContextValue>(
    () => ({ identity: storeIdentity(settings, defaultIdentity(t)), refresh, refreshing }),
    [settings, t, refresh, refreshing],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

/** The store's identity, which is all most components want. */
export function useStoreIdentity(): StoreIdentity {
  return useContext(StoreContext).identity;
}

/** The whole value, for the one caller that also drives the refresh. */
export function useStore(): StoreContextValue {
  return useContext(StoreContext);
}
