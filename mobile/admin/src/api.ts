// ACTIONS layer: the native app's API wiring and credential storage.
//
// The web admin's equivalent (frontend/apps/admin/src/api.ts) is the same
// twenty lines with two substitutions, and both differences are the point of
// this file existing rather than being shared:
//
//   import.meta.env.VITE_*  →  expo-constants (Vite's env is a build-time
//                              transform Metro does not perform)
//   localStorage            →  expo-secure-store (a token on a staff phone
//                              lives in the OS keychain, not in a plaintext
//                              key/value store an installed app leaks on backup)
//
// Everything either app DOES with the client comes from @minigames/api-client,
// which is shared verbatim.

import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@minigames/api-client";

const TOKEN_KEY = "minigames.adminToken";

/**
 * The API host, baked in at build time.
 *
 * There is no localhost fallback on purpose. A phone resolves `localhost` to
 * ITSELF, so a default would not fail loudly — it would fail as a confusing
 * connection error against the device's own loopback. An empty value surfaces
 * as a configuration message on screen instead.
 */
export const baseUrl: string = (Constants.expoConfig?.extra?.apiBaseUrl as string) ?? "";

/** True when the build was given an API host to talk to. */
export function isConfigured(): boolean {
  return baseUrl !== "";
}

export async function getToken(): Promise<string> {
  return (await SecureStore.getItemAsync(TOKEN_KEY)) ?? "";
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/** Build a client bound to a specific admin token. */
export function makeApi(token: string) {
  return createClient({ baseUrl, adminToken: token });
}
