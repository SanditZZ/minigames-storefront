import { useMemo, useState } from "react";
import type { ApiClient, Setting } from "@minigames/api-client";
import {
  STORE_BANNER_KEY,
  STORE_LOGO_KEY,
  STORE_NAME_KEY,
  STORE_TAGLINE_KEY,
} from "@minigames/api-client";
import {
  BRANDING_COLOR_NAMES,
  brandingChanges,
  brandingDirty,
  draftPalette,
  invalidBrandingColors,
  readBranding,
  type BrandingDraft,
} from "@minigames/admin-core";
import {
  COLOR_SETTING_KEYS,
  CONTRAST_AA_NORMAL,
  lowContrastPairs,
  PALETTE,
  surfaceName,
} from "@minigames/tokens";
import { ImageField } from "./ImageField";
import { Alert, Button, Card, ColorInput, Field, Input, PanelHeader, Stack } from "../ui";

/**
 * The store's identity in one place: what it is called, and what colour it is.
 *
 * These are ordinary settings — the generic rows below this card can edit them
 * too — but presenting them as a form is the difference between "an operator
 * renames their shop" and "an operator finds `store_name` in a list of eight
 * knobs and types a hex triple into a text box".
 *
 * This file is deliberately only the form. What a save actually writes — and
 * why clearing a colour deletes a row while clearing a tagline stores "" — is
 * `brandingChanges` in @minigames/admin-core, where it is unit-tested.
 */
export function StoreBranding({
  api,
  settings,
  onSaved,
}: {
  api: ApiClient;
  settings: Setting[];
  onSaved: () => void;
}) {
  const saved = useMemo(() => readBranding(settings), [settings]);
  const [draft, setDraft] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // A reload elsewhere (or another admin's edit) replaces what is stored; adopt
  // it whenever this operator has no unsaved work of their own.
  const [base, setBase] = useState(saved);
  if (base !== saved) {
    if (!brandingDirty(draft, base)) setDraft(saved);
    setBase(saved);
  }

  const dirty = brandingDirty(draft, saved);
  const invalid = invalidBrandingColors(draft);

  // Legibility, checked against the palette the PLAYER would get — resolved, so
  // a cleared field is measured as the token that will actually render there
  // rather than as a blank. Advisory on purpose: see the note beside the banner.
  const illegible = useMemo(() => lowContrastPairs(draftPalette(draft)), [draft]);
  const worst = illegible[0];

  async function save() {
    setBusy(true);
    setError("");
    try {
      for (const change of brandingChanges(draft, saved)) {
        if (change.kind === "color" && change.value === "") {
          // Cleared: stop overriding. Tolerate a 404 — the row may already be
          // gone if two tabs saved the same reset.
          if (change.previous !== "") await api.deleteSetting(change.key).catch(() => {});
          continue;
        }
        await api.upsertSetting(change.key, {
          value: change.value,
          type: change.kind,
          description: DESCRIPTIONS[change.key] ?? "",
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const set = (key: keyof BrandingDraft) => (value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <Card>
      <Stack gap="sm">
        <PanelHeader title="Store branding" />
        <p className="text-sm text-ink/60">
          What players see on the landing screen. Leave a colour empty to use the app’s built-in
          palette — saving one opts this store out of future palette changes for that colour.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Store name">
            <Input
              value={draft.name}
              placeholder="Fun Store"
              onChange={(e) => set("name")(e.target.value)}
            />
          </Field>
          <Field label="Tagline">
            <Input
              value={draft.tagline}
              placeholder="Thanks for shopping with us — try your luck!"
              onChange={(e) => set("tagline")(e.target.value)}
            />
          </Field>
        </div>

        <ImageField
          api={api}
          label="Logo"
          value={draft.logoUrl}
          onChange={set("logoUrl")}
          // Square and PNG. Square because the player renders the mark in a
          // fixed 1:1 box (StoreMark) — exporting anything else would hand
          // `object-cover` a crop the operator never saw, which is exactly what
          // this cropper exists to prevent. PNG because a logo is the one image
          // here that usually needs a transparent background; JPEG would give it
          // a white box.
          output={{ width: 400, height: 400 }}
          format="image/png"
          hint="A square mark shown above the headline. Replaces the store name; leave empty to show the name as text."
        />

        <ImageField
          api={api}
          label="Cover banner"
          value={draft.bannerUrl}
          onChange={set("bannerUrl")}
          // 3:1 and JPEG: this is photography rather than a mark, so it is the
          // opposite call to the logo on both counts — nothing is transparent
          // and the file is large enough that PNG would waste the upload cap.
          output={{ width: 1200, height: 400 }}
          hint="A wide image across the top of the landing screen, like a profile cover. Leave empty for no banner — the screen looks right without one."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          {BRANDING_COLOR_NAMES.map((name) => (
            <Field key={name} label={`${PALETTE[name].name} — ${name}`}>
              <ColorInput
                value={draft[name]}
                label={PALETTE[name].name}
                placeholder={PALETTE[name].value.toLowerCase()}
                onChange={set(name)}
              />
              <span className="mt-1 block text-xs text-ink/50">{PALETTE[name].role}</span>
            </Field>
          ))}
        </div>

        <Alert message={error} />
        {invalid.length > 0 && (
          <Alert
            message={`Not a colour: ${invalid
              .map((n) => `${PALETTE[n].name} “${draft[n]}”`)
              .join(", ")}. Use a hex value like #ff9a86, or clear it to use the default.`}
          />
        )}
        {/* A WARNING beside a live Save, never a block. A venue's real brand
            colour is not negotiable with a validator, and refusing the save
            would get the palette written into SQLite by hand instead — the same
            illegible store, with nobody warned. Only the worst pair is named:
            one unreadable ink fails every surface at once, and five rows of the
            same news is how a banner gets skimmed. */}
        {worst && (
          <Alert
            tone="warning"
            message={
              `Hard to read: ${PALETTE[worst.text].name} text on ${surfaceName(worst.on)} is ` +
              `${worst.ratio.toFixed(1)}:1, under the ${CONTRAST_AA_NORMAL}:1 minimum` +
              (illegible.length > 1
                ? ` — and ${illegible.length - 1} other pair${illegible.length > 2 ? "s" : ""} fail too`
                : "") +
              `. You can still save — check it on a phone before you do.`
            }
          />
        )}

        <div className="flex flex-wrap gap-2">
          <Button disabled={!dirty || busy || invalid.length > 0} onClick={save}>
            {busy ? "Saving…" : "Save branding"}
          </Button>
          <Button variant="ghost" disabled={!dirty || busy} onClick={() => setDraft(saved)}>
            Discard changes
          </Button>
          <Button
            variant="ghost"
            disabled={busy || BRANDING_COLOR_NAMES.every((n) => draft[n] === "")}
            onClick={() => setDraft((d) => ({ ...d, ...BLANK_COLORS }))}
          >
            Reset colours to default
          </Button>
        </div>
      </Stack>
    </Card>
  );
}

const BLANK_COLORS = Object.fromEntries(BRANDING_COLOR_NAMES.map((n) => [n, ""]));

const DESCRIPTIONS: Record<string, string> = {
  [STORE_NAME_KEY]: "Store name shown to players above the headline. Public.",
  [STORE_TAGLINE_KEY]: "Short line under the headline on the landing screen. Public.",
  [STORE_LOGO_KEY]: "Absolute URL of the store logo, shown instead of the name. Public.",
  [STORE_BANNER_KEY]:
    "Absolute URL of the store cover image, spanning the top of the landing screen. Public.",
  ...Object.fromEntries(
    BRANDING_COLOR_NAMES.map((n) => [
      COLOR_SETTING_KEYS[n],
      `Brand colour ${n} (${PALETTE[n].name}). Overrides the built-in palette. Public.`,
    ]),
  ),
};
