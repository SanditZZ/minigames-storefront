// ACTIONS layer: fetching the store's public settings. Every decision about
// what the values MEAN is delegated to pure functions in @minigames/player-core
// (storeIdentity today, the palette resolver next).

import { useCallback, useEffect, useState } from "react";
import type { PublicSettings } from "@minigames/api-client";
import { api } from "../api";

export interface PublicSettingsState {
  /** null until the first response; never an error state — see below. */
  settings: PublicSettings | null;
  /** Re-reads the settings. Safe to call at any time; concurrent calls are fine. */
  refresh: () => void;
  refreshing: boolean;
}

/**
 * Loads the storefront's admin-configured identity.
 *
 * A failure resolves to an empty map rather than an error state, for the same
 * reason usePrizes swallows its own: this is decoration on a screen whose job
 * is to start a game. The callers all fall back to built-in defaults, so a
 * dropped request costs the operator their custom name, not the player their
 * round.
 *
 * `refresh` exists because a kiosk phone is never reloaded. Settings are read
 * once on mount, so without it a store renamed at 10am still shows the old name
 * on the tablet by the till at closing time.
 */
export function usePublicSettings(): PublicSettingsState {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [token, setToken] = useState(0);

  const refresh = useCallback(() => setToken((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setRefreshing(true);

    api
      .publicSettings()
      .then((s) => alive && setSettings(s))
      .catch(() => alive && setSettings({}))
      .finally(() => alive && setRefreshing(false));

    return () => {
      alive = false;
    };
  }, [token]);

  return { settings, refresh, refreshing };
}
