// ACTIONS layer: the only place the admin app touches window.history and
// window.location. All URL reasoning is delegated to the pure functions in
// ./parse, exactly as the player app's router does.

import { useCallback, useEffect, useMemo, useState } from "react";
import { clearedFilters, hasActiveFilters, hrefFor, parseLocation, sameLocation } from "./parse";
import type { Location, Tab } from "./routes";

function readLocation(): Location {
  return parseLocation(window.location.pathname, window.location.search);
}

/** The filter fields a panel may change. Omitted keys keep their current value. */
export type FilterPatch = Partial<Omit<Location, "tab">>;

export interface AdminRouter {
  location: Location;
  /** The panel currently showing. */
  tab: Tab;
  /** "" on the list, NEW_AWARD on the create form, else the award being edited. */
  awardId: string;
  /** Switches panel, pushing a history entry so Back returns to the previous one. */
  setTab: (tab: Tab) => void;
  /** Opens an award's page — NEW_AWARD to create. Pushes, so Back returns to the list. */
  openAward: (id: string) => void;
  /** Returns to the list, keeping whatever filters were applied. */
  closeAward: () => void;
  /** Updates one or more filters in place — changing a filter is not a navigation. */
  setFilters: (patch: FilterPatch) => void;
  /** Resets every filter (keeping the sort) on the current tab. */
  clearFilters: () => void;
  /** True when something is narrowing the list. */
  filtered: boolean;
}

/**
 * A minimal history-API router for the admin shell.
 *
 * Hand-rolled for the same reason the player app's is: three panels do not
 * justify a routing dependency, and the URL stays the single source of truth
 * for what is on screen — including which filters are applied.
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
  // The award id is dropped — it belongs to the awards path, and carrying it to
  // another tab would leave state the URL cannot express.
  const setTab = useCallback(
    (tab: Tab) => go("push", { ...location, tab, awardId: "" }),
    [go, location],
  );

  // Opening an award is a navigation, so Back closes the form and returns to
  // the list — the gesture an admin reaches for after an accidental click.
  const openAward = useCallback(
    (id: string) => go("push", { ...location, tab: "awards", awardId: id }),
    [go, location],
  );

  const closeAward = useCallback(
    () => go("push", { ...location, tab: "awards", awardId: "" }),
    [go, location],
  );

  // Filters replace rather than push. Typing in a search box or flicking a
  // dropdown would otherwise bury the previous panel under one history entry
  // per keystroke, making Back useless.
  const setFilters = useCallback(
    (patch: FilterPatch) => go("replace", { ...location, ...patch }),
    [go, location],
  );

  const clearFilters = useCallback(
    () => go("replace", clearedFilters(location)),
    [go, location],
  );

  return useMemo(
    () => ({
      location,
      tab: location.tab,
      awardId: location.awardId,
      setTab,
      openAward,
      closeAward,
      setFilters,
      clearFilters,
      filtered: hasActiveFilters(location),
    }),
    [location, setTab, openAward, closeAward, setFilters, clearFilters],
  );
}
