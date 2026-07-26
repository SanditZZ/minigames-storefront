import { useState } from "react";
import type { ApiClient, Game, Setting, SettingType } from "@minigames/api-client";
import { GameBenchmarks } from "./GameBenchmarks";
import { StoreBranding } from "./StoreBranding";
import { Alert, Badge, Button, Card, ColorInput, Field, Input, Loading, PanelHeader, Select, Stack } from "../ui";

/**
 * Settings CRUD, with the store's identity lifted into a form at the top.
 *
 * The rows below it are the general case: every setting, as a typed knob the
 * backend reads at runtime (session TTL, anti-cheat cap, claim window). The
 * branding card is not a special kind of setting — the same keys appear in the
 * rows — it is the handful an operator actually came here to change, presented
 * as something other than a list of strings.
 *
 * `settings` is owned by App rather than fetched here, because the palette is
 * applied to the whole document: the shell needs the same rows this panel edits,
 * and one fetch feeding both is what makes a saved colour visible immediately.
 */
export function SettingsPanel({
  api,
  games,
  settings,
  error,
  onChanged,
}: {
  api: ApiClient;
  games: Game[];
  settings: Setting[] | null;
  error: string;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <Stack>
      <PanelHeader
        title="Settings"
        action={<Button onClick={() => setAdding((v) => !v)}>{adding ? "Close" : "+ New setting"}</Button>}
      />

      <Alert message={error} />

      {adding && (
        <NewSettingForm
          api={api}
          onSaved={() => {
            setAdding(false);
            onChanged();
          }}
        />
      )}

      {settings === null ? (
        <Loading />
      ) : (
        <Stack gap="sm">
          <StoreBranding api={api} settings={settings} onSaved={onChanged} />
          <GameBenchmarks api={api} games={games} settings={settings} onSaved={onChanged} />
          {settings.map((s) => (
            <SettingRow key={s.key} api={api} setting={s} onSaved={onChanged} onDeleted={onChanged} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function SettingRow({
  api,
  setting,
  onSaved,
  onDeleted,
}: {
  api: ApiClient;
  setting: Setting;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [value, setValue] = useState(setting.value);
  const [busy, setBusy] = useState(false);
  const dirty = value !== setting.value;

  async function save() {
    setBusy(true);
    try {
      await api.upsertSetting(setting.key, { value, type: setting.type, description: setting.description });
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <code className="font-semibold text-ink">{setting.key}</code>
        <Badge tone="neutral">{setting.type}</Badge>
      </div>
      {setting.description && <p className="mt-1 text-sm text-ink/60">{setting.description}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <ValueInput type={setting.type} value={value} onChange={setValue} />
        </div>
        <Button className="shrink-0" disabled={!dirty || busy} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button variant="danger" className="shrink-0" onClick={() => api.deleteSetting(setting.key).then(onDeleted)}>
          Delete
        </Button>
      </div>
    </Card>
  );
}

/** Renders the right control for a typed setting value. */
function ValueInput({ type, value, onChange }: { type: SettingType; value: string; onChange: (v: string) => void }) {
  if (type === "color") {
    // No placeholder default here: a generic row edits an existing colour
    // setting, so there is always a value, and guessing which palette entry it
    // belongs to would be wrong as often as right. The branding card above is
    // where a colour has a known default to fall back to.
    return <ColorInput value={value} placeholder="#ff9a86" onChange={onChange} />;
  }
  if (type === "bool") {
    return (
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="true">true</option>
        <option value="false">false</option>
      </Select>
    );
  }
  return <Input type={type === "int" ? "number" : "text"} value={value} onChange={(e) => onChange(e.target.value)} />;
}

function NewSettingForm({ api, onSaved }: { api: ApiClient; onSaved: () => void }) {
  const [key, setKey] = useState("");
  const [type, setType] = useState<SettingType>("string");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.upsertSetting(key.trim(), { value, type, description: description.trim() });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Key">
          <Input value={key} onChange={(e) => setKey(e.target.value)} required placeholder="my_setting_key" />
        </Field>
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as SettingType)}>
            <option value="string">string</option>
            <option value="int">int</option>
            <option value="bool">bool</option>
            <option value="color">color</option>
          </Select>
        </Field>
        <Field label="Value">
          <ValueInput type={type} value={value} onChange={setValue} />
        </Field>
        <Field label="Description">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Alert message={error} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy || !key.trim()}>
            {busy ? "Saving…" : "Add setting"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
