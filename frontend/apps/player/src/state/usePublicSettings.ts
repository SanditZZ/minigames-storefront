// ACTIONS layer: fetching the store's public settings. Every decision about
// what the values MEAN is delegated to pure functions in @minigames/player-core
// (storeIdentity today, the palette resolver next).

import { useCallback, useEffect, useState } from "react";
import type { PublicSettings } from "@minigames/api-client";
import { useApi } from "../i18n";
import { readSettingsCache, writeSettingsCache } from "./settingsCache";

export interface PublicSettingsState {
  /**
   * The store's settings: the last-known copy from the moment of the first
   * render, replaced by the server's answer when it arrives. null only on a
   * browser that has never successfully loaded this storefront — never an error
   * state, see below.
   */
  settings: PublicSettings | null;
  /** Re-reads the settings. Safe to call at any time; concurrent calls are fine. */
  refresh: () => void;
  refreshing: boolean;
}

/**
 * Loads the storefront's admin-configured identity.
 *
 * A failure resolves to the last-known copy, or to an empty map when there is
 * none, rather than to an error state — for the same reason usePrizes swallows
 * its own: this is decoration on a screen whose job is to start a game. The
 * callers all fall back to built-in defaults, so a dropped request costs the
 * operator their custom name, not the player their round.
 *
 * ## The first render is drawn from the last visit
 *
 * The state STARTS at the remembered copy instead of at null, which is what
 * makes a cold load paint the store rather than the defaults: the palette, the
 * wordmark and the cover banner are all in the first frame, so there is no
 * repaint and — the one that actually moved things under a thumb — no 3:1 band
 * appearing at the top of the landing screen a moment after the game list. See
 * `settings/cache.ts` in @minigames/player-core.
 *
 * The copy is a memory of the last answer, not a substitute for asking: the
 * fetch still runs on every mount, and its answer replaces the copy whatever it
 * says. The worst a stale copy can do is show one frame of yesterday's name —
 * strictly better than one frame of a name that was never the store's.
 *
 * `refresh` exists because a kiosk phone is never reloaded. Settings are read
 * once on mount, so without it a store renamed at 10am still shows the old name
 * on the tablet by the till at closing time.
 */
export function usePublicSettings(): PublicSettingsState {
  // Nothing this endpoint returns is translated — a store's name is whatever
  // the operator typed, in every language — so the re-read on a language switch
  // is redundant work rather than a correctness need. It is kept for the same
  // reason usePrizes keeps its own: one client, one rule, and it is already
  // right if the allowlist ever grows a localized value.
  const api = useApi();
  // Lazily, so storage is read once per mount rather than on every render.
  const [settings, setSettings] = useState<PublicSettings | null>(readSettingsCache);
  const [refreshing, setRefreshing] = useState(false);
  const [token, setToken] = useState(0);

  const refresh = useCallback(() => setToken((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setRefreshing(true);

    api
      .publicSettings()
      .then((s) => {
        if (!alive) return;
        setSettings(s);
        // Written only on success, so a failed request never erases a good copy
        // — and an empty response overwrites it, because an operator clearing
        // every setting is an answer too.
        writeSettingsCache(s);
      })
      // Keep whatever is already on screen. A kiosk that has loaded this store
      // before keeps its real identity through an outage; only a browser that
      // has never seen it falls through to the built-in defaults.
      .catch(() => alive && setSettings((prev) => prev ?? {}))
      .finally(() => alive && setRefreshing(false));

    return () => {
      alive = false;
    };
  }, [api, token]);

  return { settings, refresh, refreshing };
}
