// ACTIONS layer: the only place that touches window.history and window.location.
// All URL reasoning is delegated to the pure functions in ./parse.

import { useCallback, useEffect, useMemo, useState } from "react";
import { hrefFor, parseLocation, sameLocation } from "./parse";
import type { Location, Route } from "./routes";

/** Reads the browser's current URL as a Location. */
function readLocation(): Location {
  return parseLocation(window.location.pathname, window.location.search);
}

/** Optional query state to carry with a navigation. Omitted keys are inherited. */
export interface NavOptions {
  playerName?: string;
  reveal?: boolean;
}

export interface Router {
  /** Where the app currently is. */
  location: Location;
  /** Convenience alias for location.route. */
  route: Route;
  /** Display name carried in ?name=. */
  playerName: string;
  /** Whether the score-reveal animation should play. */
  reveal: boolean;
  /** Pushes a new entry — the player can press Back to return here. */
  navigate: (route: Route, opts?: NavOptions) => void;
  /** Replaces the current entry — used when Back should skip this step. */
  replace: (route: Route, opts?: NavOptions) => void;
  /** Updates ?name= in place, so typing a name never adds history entries. */
  setPlayerName: (name: string) => void;
  /** Clears ?reveal= in place once the animation has played. */
  clearReveal: () => void;
  /** Goes back one entry, or home when this is the first page in the tab. */
  back: () => void;
}

/**
 * A minimal history-API router.
 *
 * Deliberately hand-rolled: the app has three screens, so a routing library
 * would add a dependency for behaviour that fits in one hook. It listens for
 * popstate (Back/Forward) and re-reads the URL, which stays the single source of
 * truth for which screen is showing.
 */
export function useRouter(): Router {
  const [location, setLocation] = useState<Location>(readLocation);

  useEffect(() => {
    const onPop = () => setLocation(readLocation());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = useCallback(
    (mode: "push" | "replace", route: Route, opts: NavOptions = {}) => {
      const next: Location = {
        route,
        playerName: opts.playerName ?? location.playerName,
        // reveal is one-shot: it never carries over unless asked for explicitly.
        reveal: opts.reveal ?? false,
      };
      if (mode === "push" && sameLocation(next, location)) return; // no duplicate entries
      const href = hrefFor(next);
      if (mode === "push") window.history.pushState(null, "", href);
      else window.history.replaceState(null, "", href);
      setLocation(next);
    },
    [location],
  );

  const navigate = useCallback((route: Route, opts?: NavOptions) => go("push", route, opts), [go]);
  const replace = useCallback((route: Route, opts?: NavOptions) => go("replace", route, opts), [go]);

  // Typing in the name field must not spam the history stack, so the name is
  // always written with replaceState.
  const setPlayerName = useCallback(
    (name: string) => go("replace", location.route, { playerName: name, reveal: location.reveal }),
    [go, location.route, location.reveal],
  );

  // Dropping ?reveal= after the animation means a refresh or a shared link
  // shows the score straight away instead of replaying the build-up.
  const clearReveal = useCallback(() => {
    if (!location.reveal) return;
    go("replace", location.route, { reveal: false });
  }, [go, location.route, location.reveal]);

  // A player who lands directly on a result link has no history to go back to;
  // send them to the picker instead of leaving Back dead.
  const back = useCallback(() => {
    if (window.history.length > 1) window.history.back();
    else go("replace", { name: "home" });
  }, [go]);

  return useMemo(
    () => ({
      location,
      route: location.route,
      playerName: location.playerName,
      reveal: location.reveal,
      navigate,
      replace,
      setPlayerName,
      clearReveal,
      back,
    }),
    [location, navigate, replace, setPlayerName, clearReveal, back],
  );
}
