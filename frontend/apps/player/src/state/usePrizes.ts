// ACTIONS layer: fetching the prize showcase. All the shaping is delegated to
// the pure functions in @minigames/player-core.

import { useEffect, useRef, useState } from "react";
import type { Game } from "@minigames/api-client";
import { mergePrizes, orderPrizes, type ShowcasePrize } from "@minigames/player-core";
import { useApi } from "../i18n";

/**
 * Loads the prizes on offer across every game, for the landing screen.
 *
 * ONE request, whatever the catalog holds. It used to be one per game, which
 * meant the first screen every customer sees got slower each time a game was
 * added — and paid for a full read of the awards table per game on the server
 * as well. `allPrizes` answers all of them from a single query; the merge below
 * is unchanged, because the response is still grouped by game.
 *
 * `games` is no longer what builds the request — the server decides which games
 * are enabled — so it is a RE-FETCH TRIGGER and nothing more: the showcase
 * advertises the same catalog the picker renders, so it is re-read exactly when
 * that set changes. Keying on the slug list rather than the array identity keeps
 * a refresh that returns the same catalog from re-fetching.
 *
 * It is deliberately NOT what gates the first fetch. Waiting for `games` put two
 * independent requests in series on the first screen — `/games` resolved, and
 * only then did the prize strip begin — for a parameter the request no longer
 * carries. The two now go together. What makes that safe is the one line below:
 * the catalog ARRIVING is not the catalog CHANGING, so the transition from "no
 * games yet" to the first list must not re-fire the request that is already in
 * flight. Getting that wrong double-fetches on every cold load, which is a worse
 * landing screen than the serial one this replaces.
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

  // "" means the catalog has not arrived — and also an empty catalog, since
  // `[].join(",")` is "" as well. The two are not told apart on purpose: the
  // collision costs a storefront with no games at all one redundant re-read,
  // and disambiguating it would put a second piece of state beside the one
  // below to serve a store nobody can play at.
  const key = games ? games.map((g) => g.slug).join(",") : "";
  const seenKey = useRef<string | null>(null);

  useEffect(() => {
    // The catalog ARRIVING is not the catalog CHANGING: the mount already
    // fetched, so record the new key and stand down. A later edit moves the key
    // between two non-empty values and does re-read.
    const previous = seenKey.current;
    seenKey.current = key;
    if (key !== "" && previous === "") return;

    let alive = true;

    api
      .allPrizes()
      .then((batch) => alive && setPrizes(orderPrizes(mergePrizes(batch.map((g) => g.prizes)))))
      .catch(() => alive && setPrizes([]));

    return () => {
      alive = false;
    };
  }, [api, key]);

  return prizes;
}
