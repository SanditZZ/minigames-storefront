// CALCULATIONS layer: pure URL ↔ Location conversion. No history access, no
// React, no side effects — the same strings always produce the same value,
// which is what makes the admin's routing testable without a browser.

import {
  DEFAULT_LOCATION,
  DEFAULT_TAB,
  GAME_FILTER_TABS,
  GAME_PARAM,
  MAX_QUERY_LENGTH,
  QUERY_PARAM,
  SORT_PARAM,
  SORT_VALUES,
  STATUS_PARAM,
  STATUS_VALUES,
  STOCK_PARAM,
  STOCK_VALUES,
  TABS,
  type Location,
  type SortOrder,
  type StatusFilter,
  type StockFilter,
  type Tab,
} from "./routes";

/** Splits a pathname into its non-empty segments. */
function segments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

/**
 * A slug we are willing to put in a URL and forward to the API. Anything else
 * is dropped rather than sent on, so a hand-edited query string can never
 * inject a path into an API call.
 */
export function isSafeSlug(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

/** Narrows an arbitrary string to a Tab. */
export function isTab(value: string): value is Tab {
  return TABS.some((t) => t.id === value);
}

/**
 * Maps a pathname onto a tab.
 *
 * Unknown paths fall back to the default panel rather than a "not found"
 * screen. This is a three-tab internal tool behind a shared secret: a mistyped
 * URL should land an admin somewhere useful, not at a dead end.
 */
export function parseTab(pathname: string): Tab {
  const parts = segments(pathname);
  if (parts.length >= 1 && isTab(parts[0])) return parts[0];
  return DEFAULT_TAB;
}

/**
 * Reads the award addressed by the path — /awards/{id} or /awards/new.
 *
 * Only meaningful under /awards; any other tab yields "" so a stray segment
 * cannot put a different panel into an editing state. The id is validated as a
 * safe slug before it can reach an API path.
 */
export function parseAwardId(pathname: string): string {
  const parts = segments(pathname);
  if (parts.length !== 2 || parts[0] !== "awards") return "";
  return isSafeSlug(parts[1]) ? parts[1] : "";
}

/** Reads the game filter out of a query string, dropping unsafe values. */
export function parseGameSlug(search: string): string {
  const raw = new URLSearchParams(search).get(GAME_PARAM) ?? "";
  return isSafeSlug(raw) ? raw : "";
}

/**
 * Reads a value constrained to a fixed set, falling back to the default.
 *
 * Every enum-ish parameter goes through here so a hand-edited or stale URL
 * degrades to the default view instead of putting a filter into a state no
 * control can represent — which would leave an admin looking at a filtered list
 * with every dropdown claiming "All".
 */
function parseEnum<T extends string>(search: string, key: string, allowed: T[], fallback: T): T {
  const raw = new URLSearchParams(search).get(key) ?? "";
  return (allowed as string[]).includes(raw) ? (raw as T) : fallback;
}

export function parseStatus(search: string): StatusFilter {
  return parseEnum(search, STATUS_PARAM, STATUS_VALUES, "all");
}

export function parseStock(search: string): StockFilter {
  return parseEnum(search, STOCK_PARAM, STOCK_VALUES, "all");
}

export function parseSort(search: string): SortOrder {
  return parseEnum(search, SORT_PARAM, SORT_VALUES, "order");
}

/** Reads the name search, trimmed and length-capped. */
export function parseQuery(search: string): string {
  const raw = new URLSearchParams(search).get(QUERY_PARAM) ?? "";
  return raw.trim().slice(0, MAX_QUERY_LENGTH);
}

/** Parses a full URL (pathname + search) into the admin's Location. */
export function parseLocation(pathname: string, search: string): Location {
  return {
    tab: parseTab(pathname),
    awardId: parseAwardId(pathname),
    gameSlug: parseGameSlug(search),
    status: parseStatus(search),
    stock: parseStock(search),
    query: parseQuery(search),
    sort: parseSort(search),
  };
}

/** Renders a location's pathname. Inverse of parseTab + parseAwardId. */
export function pathFor(tab: Tab, awardId = ""): string {
  if (tab === "awards" && awardId) return `/awards/${awardId}`;
  return `/${tab}`;
}

/** True when a tab understands the shared ?game= filter. */
export function usesGameFilter(tab: Tab): boolean {
  return GAME_FILTER_TABS.includes(tab);
}

/**
 * Builds the full href for a location.
 *
 * Two rules keep URLs readable. A parameter is emitted only when it differs
 * from the default, so an unfiltered panel is a bare path rather than a row of
 * "=all". And a parameter is emitted only on a tab that actually honours it, so
 * switching away from Awards does not drag its filters along as dead weight —
 * except ?game=, which is shared by design (see routes.ts).
 */
export function hrefFor(location: Location): string {
  const path = pathFor(location.tab, location.awardId);
  const params = new URLSearchParams();

  if (location.gameSlug && usesGameFilter(location.tab)) {
    params.set(GAME_PARAM, location.gameSlug);
  }

  // The remaining filters belong to the awards list alone.
  if (location.tab === "awards") {
    if (location.status !== DEFAULT_LOCATION.status) params.set(STATUS_PARAM, location.status);
    if (location.stock !== DEFAULT_LOCATION.stock) params.set(STOCK_PARAM, location.stock);
    if (location.query) params.set(QUERY_PARAM, location.query);
    if (location.sort !== DEFAULT_LOCATION.sort) params.set(SORT_PARAM, location.sort);
  }

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/** True when two locations address the same thing, so no-op pushes are skipped. */
export function sameLocation(a: Location, b: Location): boolean {
  return hrefFor(a) === hrefFor(b);
}

/**
 * Decides which game a panel should actually show, given the URL's request and
 * the catalog that exists.
 *
 * The URL is a wish, not a guarantee: it may name nothing (first visit), or a
 * game that has since been disabled or renamed — a stale bookmark. Either way
 * the panel falls back to the first game in the catalog rather than querying a
 * slug the backend will 404 on. Returns "" only when there are no games at all.
 *
 * Used by the scores panel, which must always have exactly one game selected.
 * The awards panel does NOT use it: there, no game means "show them all", which
 * is a legitimate view rather than a missing selection.
 */
export function resolveGameSlug(requested: string, available: string[]): string {
  if (requested && available.includes(requested)) return requested;
  return available[0] ?? "";
}

/** True when any award filter is narrowing the list — drives "Clear filters". */
export function hasActiveFilters(location: Location): boolean {
  return (
    location.gameSlug !== "" ||
    location.status !== DEFAULT_LOCATION.status ||
    location.stock !== DEFAULT_LOCATION.stock ||
    location.query !== ""
  );
}

/**
 * Clears every filter while staying on the current tab.
 *
 * Sort is deliberately preserved: it is a display preference, not a filter, and
 * silently reordering the list as a side effect of clearing filters would be a
 * second unrequested change.
 */
export function clearedFilters(location: Location): Location {
  return {
    ...DEFAULT_LOCATION,
    tab: location.tab,
    awardId: location.awardId,
    sort: location.sort,
  };
}
