// CALCULATIONS layer: reading the admin's `Setting[]` as a lookup.
//
// The admin lists settings as rows because it edits them as rows — each with a
// type, a description and an edit timestamp. Everything that merely *reads* a
// setting wants a lookup instead, and the player app is already handed one by
// GET /api/v1/settings/public. This is the one conversion between the two, so
// the admin can reuse the player's palette and identity resolvers verbatim
// rather than growing a second set that speaks `Setting[]`.

import type { Setting } from "@minigames/api-client";

/**
 * Projects settings rows onto the same flat key→value map the public endpoint
 * serves.
 *
 * Later rows win on a duplicate key, which cannot happen — `key` is the primary
 * key — but is the sane reading of a list that somehow contained one.
 */
export function settingsToMap(settings: Setting[] | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of settings ?? []) out[s.key] = s.value;
  return out;
}

/** One setting's value, or "" when it is not set. */
export function settingValue(settings: Setting[] | null | undefined, key: string): string {
  return settingsToMap(settings)[key] ?? "";
}
