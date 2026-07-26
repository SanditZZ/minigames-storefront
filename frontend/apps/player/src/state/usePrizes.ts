// ACTIONS layer: fetching the prize showcase. All the shaping is delegated to
// the pure functions in @minigames/player-core.

import { useEffect, useState } from "react";
import type { Game } from "@minigames/api-client";
import { mergePrizes, orderPrizes, type ShowcasePrize } from "@minigames/player-core";
import { useApi } from "../i18n";

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
  // The prize NAMES are admin free text and are not translated today, so this
  // re-reads on a language switch for nothing. That is deliberate rather than
  // an oversight: it is one request, and it is the line that starts working the
  // day awards grow a per-locale column (see docs/potential-features.md).
  const api = useApi();
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
  }, [api, key]);

  return prizes;
}
