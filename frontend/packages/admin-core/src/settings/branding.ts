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
import {
  STORE_BANNER_KEY,
  STORE_LOGO_KEY,
  STORE_NAME_KEY,
  STORE_TAGLINE_KEY,
} from "@minigames/api-client";
import {
  COLOR_SETTING_KEYS,
  isHexColor,
  resolvePalette,
  type ColorName,
} from "@minigames/tokens";
import { settingValue } from "./map";

/** Palette entries in a fixed order, so the form and its tests agree. */
export const BRANDING_COLOR_NAMES = Object.keys(COLOR_SETTING_KEYS) as ColorName[];

/** The branding form's fields. "" means unset for every one of them. */
export type BrandingDraft = {
  name: string;
  tagline: string;
  logoUrl: string;
  bannerUrl: string;
} & Record<ColorName, string>;

/** The text fields, paired with the setting each one is stored in. */
type TextField = { field: "name" | "tagline" | "logoUrl" | "bannerUrl"; key: string };

/**
 * The string-valued half of the form, as data.
 *
 * A table rather than four near-identical `if (draft.x !== saved.x)` blocks:
 * they differ only in which key they write, and the fourth one — the banner —
 * is what made copying the third indefensible. The order is the order a save
 * performs the writes in, which the tests read against.
 */
const TEXT_FIELDS: TextField[] = [
  { field: "name", key: STORE_NAME_KEY },
  { field: "tagline", key: STORE_TAGLINE_KEY },
  // A cleared image stores "" rather than deleting the row: unlike a colour,
  // these settings are seeded-shaped — the client reads "" as "no image", so
  // there is no default to fall back to and nothing to restore.
  { field: "logoUrl", key: STORE_LOGO_KEY },
  { field: "bannerUrl", key: STORE_BANNER_KEY },
];

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
    ...(Object.fromEntries(
      TEXT_FIELDS.map(({ field, key }) => [field, settingValue(settings, key)]),
    ) as Pick<BrandingDraft, TextField["field"]>),
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

  for (const { field, key } of TEXT_FIELDS) {
    if (draft[field] !== saved[field]) {
      out.push({ key, value: draft[field].trim(), previous: saved[field], kind: "string" });
    }
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

/**
 * The palette the player would actually see if this draft were saved.
 *
 * It goes through `resolvePalette` rather than reading the draft directly, so
 * the form previews colour with the SAME precedence rule the app renders with —
 * blank and malformed both fall back to the token. Re-deriving that here would
 * be a second definition of "override", and the two would disagree the first
 * time either changed.
 *
 * What it is for: contrast. `lowContrastPairs` needs five resolved colours, and
 * a draft is five strings that may each be a colour, a blank, or a hex someone
 * is halfway through typing.
 */
export function draftPalette(draft: BrandingDraft): Record<ColorName, string> {
  return resolvePalette(
    Object.fromEntries(BRANDING_COLOR_NAMES.map((n) => [COLOR_SETTING_KEYS[n], draft[n]])),
  );
}

/** True when the draft differs from what is stored. */
export function brandingDirty(draft: BrandingDraft, saved: BrandingDraft): boolean {
  return brandingChanges(draft, saved).length > 0;
}
