import { useMemo, useState } from "react";
import type { ApiClient, Setting } from "@minigames/api-client";
import { STORE_LOGO_KEY, STORE_NAME_KEY, STORE_TAGLINE_KEY } from "@minigames/api-client";
import {
  BRANDING_COLOR_NAMES,
  brandingChanges,
  brandingDirty,
  invalidBrandingColors,
  readBranding,
  type BrandingDraft,
} from "@minigames/admin-core";
import { COLOR_SETTING_KEYS, PALETTE } from "@minigames/tokens";
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
          // Wide and PNG: the player renders the logo height-capped at any
          // width, and a logo is the one image here that usually needs a
          // transparent background — JPEG would give it a white box.
          output={{ width: 600, height: 200 }}
          format="image/png"
          hint="Replaces the store name above the headline. Wide marks work best; leave empty to show the name as text."
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
  ...Object.fromEntries(
    BRANDING_COLOR_NAMES.map((n) => [
      COLOR_SETTING_KEYS[n],
      `Brand colour ${n} (${PALETTE[n].name}). Overrides the built-in palette. Public.`,
    ]),
  ),
};
