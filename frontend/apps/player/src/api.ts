import { createClient, type ApiClient } from "@minigames/api-client";
import type { Locale } from "@minigames/player-core";

// Player app is unauthenticated — it only calls public play-flow endpoints.
const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

/**
 * One client per language, built on first use.
 *
 * The locale is baked into a client rather than set on it, so a request can
 * never be issued against a language that changed while it was in flight. The
 * cache exists because the client is part of what the locale context memoises:
 * rebuilding it on every render would hand every consuming effect a new
 * dependency and refetch the catalog on each paint.
 *
 * Module-level state, deliberately in its own file with an accessor rather than
 * sitting next to anything pure — see the layering rules in CLAUDE.md. It is a
 * memo and nothing more: the map is only ever added to, and the value for a
 * given locale never changes once built.
 *
 * Screens reach this through `useApi()` in ../i18n rather than importing it:
 * half of what the API returns is text — game names, score units, the error a
 * failed round produces — so a screen holding a fixed client would render a
 * Thai page around an English game name.
 */
const clients = new Map<Locale, ApiClient>();

/** The API client that asks the backend to answer in `locale`. */
export function apiFor(locale: Locale): ApiClient {
  let client = clients.get(locale);
  if (!client) {
    client = createClient({ baseUrl, locale });
    clients.set(locale, client);
  }
  return client;
}
