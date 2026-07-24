import { createClient } from "@minigames/api-client";

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
const TOKEN_KEY = "minigames.adminToken";

/** Persist the admin shared secret locally so it survives reloads. */
export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Build a client bound to a specific admin token. */
export function makeApi(token: string) {
  return createClient({ baseUrl, adminToken: token });
}
