// ACTIONS layer: the only place the admin app touches window.history and
// window.location. All URL reasoning is delegated to the pure functions in
// ./parse, exactly as the player app's router does.

import { useCallback, useEffect, useMemo, useState } from "react";
import { hrefFor, parseLocation, sameLocation } from "./parse";
import type { Location, Tab } from "./routes";

function readLocation(): Location {
  return parseLocation(window.location.pathname, window.location.search);
}

export interface AdminRouter {
  location: Location;
  /** The panel currently showing. */
  tab: Tab;
  /** Game slug from ?game=; empty string when unset. */
  gameSlug: string;
  /** Switches panel, pushing a history entry so Back returns to the previous one. */
  setTab: (tab: Tab) => void;
  /** Updates ?game= in place — changing a filter is not a navigation. */
  setGameSlug: (slug: string) => void;
}

/**
 * A minimal history-API router for the admin shell.
 *
 * Hand-rolled for the same reason the player app's is: three panels do not
 * justify a routing dependency, and the URL stays the single source of truth
 * for which one is showing.
 */
export function useRouter(): AdminRouter {
  const [location, setLocation] = useState<Location>(readLocation);

  useEffect(() => {
    const onPop = () => setLocation(readLocation());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = useCallback(
    (mode: "push" | "replace", next: Location) => {
      if (mode === "push" && sameLocation(next, location)) return; // no duplicate entries
      const href = hrefFor(next);
      if (mode === "push") window.history.pushState(null, "", href);
      else window.history.replaceState(null, "", href);
      setLocation(next);
    },
    [location],
  );

  // Switching panel is a navigation: it pushes, so Back goes to the last panel.
  const setTab = useCallback(
    (tab: Tab) => go("push", { ...location, tab }),
    [go, location],
  );

  // Changing the game filter replaces, so flicking through games in a dropdown
  // does not bury the previous panel under a pile of history entries.
  const setGameSlug = useCallback(
    (gameSlug: string) => go("replace", { ...location, gameSlug }),
    [go, location],
  );

  return useMemo(
    () => ({ location, tab: location.tab, gameSlug: location.gameSlug, setTab, setGameSlug }),
    [location, setTab, setGameSlug],
  );
}
