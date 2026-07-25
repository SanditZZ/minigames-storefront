// CALCULATIONS layer: pure URL ↔ Location conversion. No history access, no
// React, no side effects — the same strings always produce the same value,
// which is what makes the admin's routing testable without a browser.

import { DEFAULT_TAB, GAME_PARAM, TABS, type Location, type Tab } from "./routes";

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
  if (parts.length === 1 && isTab(parts[0])) return parts[0];
  return DEFAULT_TAB;
}

/** Reads the game filter out of a query string, dropping unsafe values. */
export function parseGameSlug(search: string): string {
  const raw = new URLSearchParams(search).get(GAME_PARAM) ?? "";
  return isSafeSlug(raw) ? raw : "";
}

/** Parses a full URL (pathname + search) into the admin's Location. */
export function parseLocation(pathname: string, search: string): Location {
  return { tab: parseTab(pathname), gameSlug: parseGameSlug(search) };
}

/** Renders a tab back to its pathname. Inverse of parseTab. */
export function pathFor(tab: Tab): string {
  return `/${tab}`;
}

/**
 * Builds the full href for a location.
 *
 * The game filter is only emitted on the scores panel — it means nothing on the
 * others, and carrying it around would leave a stale parameter in the URL after
 * switching tabs.
 */
export function hrefFor(location: Location): string {
  const path = pathFor(location.tab);
  if (location.tab !== "scores" || !location.gameSlug) return path;
  const params = new URLSearchParams({ [GAME_PARAM]: location.gameSlug });
  return `${path}?${params.toString()}`;
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
 */
export function resolveGameSlug(requested: string, available: string[]): string {
  if (requested && available.includes(requested)) return requested;
  return available[0] ?? "";
}
