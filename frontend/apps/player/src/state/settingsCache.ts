// ACTIONS layer: the web player's copy of the store's last-known settings.
//
// Every rule about what a valid copy looks like is pure and shared —
// `decodeSettings` in @minigames/player-core, which also explains why the copy
// is treated as untrusted input. What is left here is the browser: which
// storage, and the fact that touching it can throw.
//
// `localStorage` rather than `sessionStorage`, because the case this exists for
// is the visit that starts cold — a customer opening the storefront tomorrow,
// or a kiosk phone rebooted overnight. A session-scoped copy would be empty at
// exactly the moment it is wanted.
//
// Both functions swallow their failures. Reading `localStorage` throws outright
// in some privacy modes, and writing throws on a full quota; neither is worth a
// broken storefront, because the whole feature is an optimisation over
// behaviour that already works. A store whose copy cannot be kept simply
// flashes, the way every store did before this.

import type { PublicSettings } from "@minigames/api-client";
import { decodeSettings, encodeSettings, SETTINGS_CACHE_KEY } from "@minigames/player-core";

/** The last settings this browser saw, or null if there is no usable copy. */
export function readSettingsCache(): PublicSettings | null {
  try {
    return decodeSettings(window.localStorage.getItem(SETTINGS_CACHE_KEY));
  } catch {
    return null;
  }
}

/** Remembers a response for the next cold load. Only ever called with a real one. */
export function writeSettingsCache(settings: PublicSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_CACHE_KEY, encodeSettings(settings));
  } catch {
    // Nothing to do and nothing to report: see the note at the top.
  }
}
