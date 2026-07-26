// CALCULATIONS layer: what the store-branding form shows, and what saving it
// has to write.
//
// The interesting part is not the form — it is that "empty" means two different
// things on the two halves of it, and the difference has to be decided
// somewhere testable:
//
//   name/tagline  are SEEDED settings. Clearing one writes an empty value and
//                 the client falls back to its built-in string.
//   colours       are NOT seeded. Clearing one must DELETE the row, because a
//                 stored "" is a setting nobody chose, and `resolvePalette`
//                 would have to special-case it forever.
//
// Getting that backwards leaves an operator unable to undo a colour, which is
// the kind of bug that is only discovered by an operator.

import type { Setting } from "@minigames/api-client";
import { STORE_NAME_KEY, STORE_TAGLINE_KEY } from "@minigames/api-client";
import { COLOR_SETTING_KEYS, isHexColor, type ColorName } from "@minigames/tokens";
import { settingValue } from "./map";

/** Palette entries in a fixed order, so the form and its tests agree. */
export const BRANDING_COLOR_NAMES = Object.keys(COLOR_SETTING_KEYS) as ColorName[];

/** The branding form's fields. "" means unset for every one of them. */
export type BrandingDraft = { name: string; tagline: string } & Record<ColorName, string>;

/** One write a save must perform. `value` of "" with kind "color" is a delete. */
export interface BrandingChange {
  key: string;
  value: string;
  /** What is currently stored, so a no-op delete can be skipped. */
  previous: string;
  kind: "string" | "color";
}

/** The saved branding, read out of the admin's settings rows. */
export function readBranding(settings: Setting[] | null | undefined): BrandingDraft {
  return {
    name: settingValue(settings, STORE_NAME_KEY),
    tagline: settingValue(settings, STORE_TAGLINE_KEY),
    ...(Object.fromEntries(
      BRANDING_COLOR_NAMES.map((n) => [n, settingValue(settings, COLOR_SETTING_KEYS[n])]),
    ) as Record<ColorName, string>),
  };
}

/**
 * The writes a save has to make — only the fields that actually changed, so an
 * operator fixing a typo in the tagline does not rewrite five colour rows and
 * their timestamps.
 *
 * Values are normalised the way they are stored: trimmed, and lowercased for
 * colours, so `#FF9A86` and `#ff9a86` are the same override rather than two.
 */
export function brandingChanges(draft: BrandingDraft, saved: BrandingDraft): BrandingChange[] {
  const out: BrandingChange[] = [];

  if (draft.name !== saved.name) {
    out.push({ key: STORE_NAME_KEY, value: draft.name.trim(), previous: saved.name, kind: "string" });
  }
  if (draft.tagline !== saved.tagline) {
    out.push({
      key: STORE_TAGLINE_KEY,
      value: draft.tagline.trim(),
      previous: saved.tagline,
      kind: "string",
    });
  }
  for (const name of BRANDING_COLOR_NAMES) {
    if (draft[name] !== saved[name]) {
      out.push({
        key: COLOR_SETTING_KEYS[name],
        value: draft[name].trim().toLowerCase(),
        previous: saved[name],
        kind: "color",
      });
    }
  }
  return out;
}

/**
 * Colour fields holding something that is neither empty nor a colour.
 *
 * Empty is excluded because it is how an override is cleared — flagging it as
 * invalid would make "use the default" look like a mistake.
 */
export function invalidBrandingColors(draft: BrandingDraft): ColorName[] {
  return BRANDING_COLOR_NAMES.filter((n) => draft[n] !== "" && !isHexColor(draft[n]));
}

/** True when the draft differs from what is stored. */
export function brandingDirty(draft: BrandingDraft, saved: BrandingDraft): boolean {
  return brandingChanges(draft, saved).length > 0;
}
