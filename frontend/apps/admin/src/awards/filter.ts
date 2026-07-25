// CALCULATIONS layer: narrowing and ordering the awards list. Pure functions —
// no fetching, no React, no sorting in place.

import type { Award } from "@minigames/api-client";
import { UNLIMITED_STOCK } from "@minigames/api-client";
import type { SortOrder, StatusFilter, StockFilter } from "../router";

export interface AwardQuery {
  /** "" means every game. */
  gameSlug: string;
  status: StatusFilter;
  stock: StockFilter;
  /** Free-text name search; "" means no search. */
  query: string;
}

/**
 * Whether an award is on offer for a game.
 *
 * An award with an empty gameSlug is a WILDCARD: the backend awards it for
 * every game (see reward.appliesToGame), so filtering to "Tap Fast" must show
 * it too. Hiding wildcards behind a game filter would tell an admin a prize
 * is not offered when it is — the exact mistake this panel exists to prevent.
 */
export function appliesToGame(award: Award, gameSlug: string): boolean {
  if (!gameSlug) return true;
  return award.gameSlug === "" || award.gameSlug === gameSlug;
}

/** Whether an award matches the active/inactive filter. */
export function matchesStatus(award: Award, status: StatusFilter): boolean {
  if (status === "all") return true;
  return status === "active" ? award.active : !award.active;
}

/** Whether an award matches the stock filter. */
export function matchesStock(award: Award, stock: StockFilter): boolean {
  switch (stock) {
    case "all":
      return true;
    case "unlimited":
      return award.stock === UNLIMITED_STOCK;
    case "out":
      return award.stock === 0;
    case "in":
      // Unlimited counts as in stock: it is, endlessly.
      return award.stock === UNLIMITED_STOCK || award.stock > 0;
  }
}

/** Case-insensitive name search. An empty query matches everything. */
export function matchesQuery(award: Award, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return award.name.toLowerCase().includes(q);
}

/** Applies every filter. Order of the surviving awards is preserved. */
export function filterAwards(awards: Award[], q: AwardQuery): Award[] {
  return awards.filter(
    (a) =>
      appliesToGame(a, q.gameSlug) &&
      matchesStatus(a, q.status) &&
      matchesStock(a, q.stock) &&
      matchesQuery(a, q.query),
  );
}

/**
 * Stock as a comparable number.
 *
 * UNLIMITED_STOCK is -1 on the wire, which would sort an endless prize below a
 * sold-out one. Treating it as Infinity puts "never runs out" at the top of a
 * most-stock-first list, which is what the label means.
 */
function stockRank(award: Award): number {
  return award.stock === UNLIMITED_STOCK ? Number.POSITIVE_INFINITY : award.stock;
}

/**
 * Orders the list. Returns a new array — never sorts the caller's copy.
 *
 * "order" is the admin-configured sortOrder, the ordering the reward engine
 * itself uses to break ties, so it is the default and the one that matches what
 * players experience. Every comparator falls back to name so the result is
 * stable and never depends on fetch order.
 */
export function sortAwards(awards: Award[], sort: SortOrder): Award[] {
  const byName = (a: Award, b: Award) => a.name.localeCompare(b.name);

  return [...awards].sort((a, b) => {
    switch (sort) {
      case "name":
        return byName(a, b);
      case "threshold":
        return a.minScore - b.minScore || byName(a, b);
      case "stock":
        return stockRank(b) - stockRank(a) || byName(a, b);
      case "order":
        return a.sortOrder - b.sortOrder || byName(a, b);
    }
  });
}

/** Filter then sort — the one call a panel needs. */
export function visibleAwards(awards: Award[], q: AwardQuery, sort: SortOrder): Award[] {
  return sortAwards(filterAwards(awards, q), sort);
}
