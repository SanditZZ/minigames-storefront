import { useCallback, useEffect, useState } from "react";
import type { ApiClient, Setting, SettingType } from "@minigames/api-client";
import { Badge, Button, Card, Field, Input, Select } from "../ui";

/**
 * Settings CRUD. Each setting is a typed knob the backend reads at runtime
 * (session TTL, anti-cheat cap, etc.). The panel edits value/description and
 * can add new keys; the backend validates that a value parses as its type.
 */
export function SettingsPanel({ api }: { api: ApiClient }) {
  const [settings, setSettings] = useState<Setting[] | null>(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api
      .listSettings()
      .then(setSettings)
      .catch((e) => setError(e.message ?? "Failed to load settings"));
  }, [api]);

  useEffect(load, [load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="min-w-0 flex-1 truncate text-lg font-bold text-ink">Settings</h2>
        <Button className="shrink-0 whitespace-nowrap" onClick={() => setAdding((v) => !v)}>
          {adding ? "Close" : "+ New setting"}
        </Button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {adding && (
        <NewSettingForm
          api={api}
          onSaved={() => {
            setAdding(false);
            load();
          }}
        />
      )}

      {settings === null ? (
        <p className="text-ink/50">Loading…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {settings.map((s) => (
            <SettingRow key={s.key} api={api} setting={s} onSaved={load} onDeleted={load} />
          ))}
        </div>
      )}
    </div>
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
  if (type === "bool") {
    return (
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="true">true</option>
        <option value="false">false</option>
      </Select>
    );
  }
  return (
    <Input
      type={type === "int" ? "number" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
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
          </Select>
        </Field>
        <Field label="Value">
          <ValueInput type={type} value={value} onChange={setValue} />
        </Field>
        <Field label="Description">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-red-700 sm:col-span-2">{error}</p>}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy || !key.trim()}>
            {busy ? "Saving…" : "Add setting"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
