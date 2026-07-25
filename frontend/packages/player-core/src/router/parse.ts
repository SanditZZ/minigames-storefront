// CALCULATIONS layer: pure URL ↔ Location conversion. No history access, no
// React, no side effects — given the same strings these always return the same
// value, which is what makes the routing logic testable in isolation.

import { MAX_NAME_LENGTH, NAME_PARAM, REVEAL_PARAM, type Location, type Route } from "./routes";

/** Splits a pathname into its non-empty segments. */
function segments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

/**
 * A slug/id we are willing to put in a URL and send to the API. Anything else
 * is treated as an unknown route rather than forwarded to the backend, so a
 * hand-edited URL can never inject a path into an API call.
 */
export function isSafeSegment(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

/** Maps a pathname onto a Route. Unrecognised paths become notFound. */
export function parsePath(pathname: string): Route {
  const parts = segments(pathname);

  if (parts.length === 0) return { name: "home" };

  if (parts[0] === "play" && parts.length === 2 && isSafeSegment(parts[1])) {
    return { name: "play", slug: parts[1] };
  }

  if (parts[0] === "result" && parts.length === 3 && isSafeSegment(parts[1]) && isSafeSegment(parts[2])) {
    return { name: "result", slug: parts[1], scoreId: parts[2] };
  }

  return { name: "notFound", path: pathname };
}

/** Reads the display name out of a query string, trimmed and length-capped. */
export function parsePlayerName(search: string): string {
  const raw = new URLSearchParams(search).get(NAME_PARAM) ?? "";
  return raw.trim().slice(0, MAX_NAME_LENGTH);
}

/** Reads the one-shot reveal flag out of a query string. */
export function parseReveal(search: string): boolean {
  return new URLSearchParams(search).get(REVEAL_PARAM) === "1";
}

/** Parses a full URL (pathname + search) into the app's Location. */
export function parseLocation(pathname: string, search: string): Location {
  return {
    route: parsePath(pathname),
    playerName: parsePlayerName(search),
    reveal: parseReveal(search),
  };
}

/** Renders a Route back to its pathname. Inverse of parsePath. */
export function pathFor(route: Route): string {
  switch (route.name) {
    case "home":
      return "/";
    case "play":
      return `/play/${route.slug}`;
    case "result":
      return `/result/${route.slug}/${route.scoreId}`;
    case "notFound":
      return route.path;
  }
}

/**
 * Builds the full href for a location, preserving the display name so it
 * survives every navigation (and stays visible/editable in the address bar).
 * The reveal flag is only ever emitted for a result URL — it is meaningless
 * anywhere else.
 */
export function hrefFor(location: Location): string {
  const params = new URLSearchParams();
  const name = location.playerName.trim().slice(0, MAX_NAME_LENGTH);
  if (name) params.set(NAME_PARAM, name);
  if (location.reveal && location.route.name === "result") params.set(REVEAL_PARAM, "1");

  const query = params.toString();
  return query ? `${pathFor(location.route)}?${query}` : pathFor(location.route);
}

/** True when two locations address the same thing, so we can skip no-op pushes. */
export function sameLocation(a: Location, b: Location): boolean {
  return hrefFor(a) === hrefFor(b);
}
