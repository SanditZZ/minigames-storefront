// ACTIONS layer: fetching the prize showcase. All the shaping is delegated to
// the pure functions in ../prizes/merge.

import { useEffect, useState } from "react";
import type { Game } from "@minigames/api-client";
import { api } from "../api";
import { mergePrizes, orderPrizes, type ShowcasePrize } from "../prizes/merge";

/**
 * Loads the prizes on offer across every game, for the landing screen.
 *
 * One request per game, in parallel. That is two calls today and is fine at
 * this size; if the catalog grows this is the natural place to swap in a single
 * batched endpoint or a cache, without touching the component.
 *
 * A failure resolves to an empty list rather than an error state: the showcase
 * is advertising, and a landing screen that refuses to render its game picker
 * because the prize strip could not load would be a far worse outcome than a
 * missing strip.
 */
export function usePrizes(games: Game[] | null): ShowcasePrize[] {
  const [prizes, setPrizes] = useState<ShowcasePrize[]>([]);

  // Keyed on the slug list rather than the array identity, so a re-fetch of the
  // same catalog does not re-trigger this.
  const key = games ? games.map((g) => g.slug).join(",") : "";

  useEffect(() => {
    if (!key) return;
    let alive = true;

    Promise.all(key.split(",").map((slug) => api.gamePrizes(slug).catch(() => [])))
      .then((lists) => alive && setPrizes(orderPrizes(mergePrizes(lists))))
      .catch(() => alive && setPrizes([]));

    return () => {
      alive = false;
    };
  }, [key]);

  return prizes;
}
