import { useState } from "react";
import type { ApiClient, Game, Setting, SettingType } from "@minigames/api-client";
import {
  describeStored,
  durationSpecFor,
  formatDuration,
  parseDuration,
  type DurationSpec,
  type DurationValue,
} from "@minigames/admin-core";
import { DisplayLink } from "./DisplayLink";
import { GameBenchmarks } from "./GameBenchmarks";
import { StoreBranding } from "./StoreBranding";
import {
  Alert,
  Badge,
  Button,
  Card,
  ColorInput,
  DurationInput,
  Field,
  Input,
  NumberInput,
  Loading,
  PanelHeader,
  Select,
  Stack,
} from "../ui";

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
          <DisplayLink games={games} />
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
  // A duration is two controls, not one, and two controls plus Save plus Delete
  // do not fit on a 375px row — the number collapsed to a sliver and Save
  // landed on top of the unit dropdown. It takes its own line instead.
  const duration = setting.type === "int" ? durationSpecFor(setting.key) : null;

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
      {CAVEATS[setting.key] && (
        <p className="mt-1 text-sm font-medium text-ink/70">{CAVEATS[setting.key]}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className={duration ? "basis-full" : "min-w-0 flex-1"}>
          <ValueInput settingKey={setting.key} type={setting.type} value={value} onChange={setValue} />
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

/**
 * Extra prose for settings whose effect is narrower than their name suggests,
 * shown under the description the backend serves.
 *
 * It lives HERE rather than in the seeded `description` for a reason worth
 * knowing before adding to it: settings are seeded only when absent (see
 * `Seed` in backend/internal/app/seed.go), so editing a seed description never
 * reaches a database that already has the row. Every store running today would
 * keep the old text. Client-side copy reaches all of them on the next deploy.
 *
 * Keyed exactly as the backend stores the setting, same as DURATION_SETTINGS.
 * English only, like the rest of this app.
 */
const CAVEATS: Record<string, string> = {
  // The one knob in this panel that looks retroactive and is not. `issueClaim`
  // reads it once and stamps the deadline into `claims.expires_at`, which is the
  // right storage model — a claim's deadline should not move under the person
  // holding it — but an admin shortening the window would otherwise expect every
  // outstanding prize to lapse sooner, and none of them will.
  claim_ttl_hours:
    "Applies to prizes won from now on. Claims already issued keep the deadline they were given when they were won.",
};

/**
 * Renders the right control for a setting value.
 *
 * Mostly a function of `type`, with one exception: a duration is an `int` like
 * any other, so what makes `claim_ttl_hours` readable is its KEY. Hence the key
 * is passed alongside the type and checked first — the alternative would be a
 * new SettingType, which would mean a migration and a wire change to fix a
 * display problem.
 *
 * The key doubles as the control's accessible NAME, which is the other reason
 * it is threaded down here. The row prints it in a `<code>` element that
 * nothing associates with the input, so a screen reader used to hear an
 * anonymous edit box once per setting — eight of them in a column, each one
 * "edit text". Sighted users read the key above the box; this is that same
 * information, delivered the other way.
 */
function ValueInput({
  settingKey,
  type,
  value,
  onChange,
}: {
  settingKey: string;
  type: SettingType;
  value: string;
  onChange: (v: string) => void;
}) {
  const duration = type === "int" ? durationSpecFor(settingKey) : null;
  if (duration) return <DurationValueInput spec={duration} label={settingKey} value={value} onChange={onChange} />;

  if (type === "color") {
    // No placeholder default here: a generic row edits an existing colour
    // setting, so there is always a value, and guessing which palette entry it
    // belongs to would be wrong as often as right. The branding card above is
    // where a colour has a known default to fall back to.
    return <ColorInput value={value} label={settingKey} placeholder="#ff9a86" onChange={onChange} />;
  }
  if (type === "bool") {
    return (
      <Select aria-label={settingKey} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="true">true</option>
        <option value="false">false</option>
      </Select>
    );
  }
  // An int setting with no duration spec still gets the real number control —
  // the generic row is where an arbitrary knob is edited, and it inherited the
  // native spinner along with everything else. The value stays a STRING on the way
  // in and out because the row's dirty check, save and delete all compare against
  // what the backend stores; NumberInput speaks number|null, so this is the one
  // place that conversion lives. No steppers: nothing here knows what a step
  // would mean for an unknown key.
  if (type === "int") {
    return (
      <NumberInput
        label={settingKey}
        bounds={{ step: 1 }}
        value={value.trim() === "" ? null : Number(value)}
        onChange={(v) => onChange(v === null ? "" : String(v))}
      />
    );
  }
  return <Input aria-label={settingKey} type="text" value={value} onChange={(e) => onChange(e.target.value)} />;
}

/**
 * A duration setting, shown as an amount and a unit.
 *
 * The component holds the amount/unit pair while it is being edited and reports
 * the STORED string upward, so the row's dirty check, its save and its delete
 * all keep working on the value the backend actually sees. Every conversion is
 * a pure function in `@minigames/admin-core` — nothing here does arithmetic.
 *
 * A value the parser refuses — a hand-edited `"1.5"` or `"abc"` in the settings
 * table — falls back to the raw text box rather than being coerced. Coercing it
 * would repair a broken row by silently changing store policy, and the operator
 * would never see what it used to say.
 */
function DurationValueInput({
  spec,
  label,
  value,
  onChange,
}: {
  spec: DurationSpec;
  /** The setting's key, used to name whichever control ends up rendered. */
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const parsed = parseDuration(value, spec);
  // Held locally so "0" does not lose the unit the operator picked: every unit
  // divides zero, so re-deriving from the stored string on each keystroke would
  // snap the dropdown back to the base unit mid-edit.
  const [draft, setDraft] = useState<DurationValue | null>(parsed);
  const shown = draft ?? parsed;

  if (!shown) {
    return <Input aria-label={label} type="text" value={value} onChange={(e) => onChange(e.target.value)} />;
  }

  return (
    <DurationInput
      label={label}
      value={shown}
      units={spec.units}
      note={describeStored(shown, spec)}
      onChange={(next) => {
        setDraft(next);
        onChange(formatDuration(next, spec));
      }}
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
            <option value="color">color</option>
          </Select>
        </Field>
        <Field label="Value">
          {/* The key is live as it is typed, so re-creating a known duration
              setting by hand gets the same control the row above it has. */}
          <ValueInput settingKey={key.trim()} type={type} value={value} onChange={setValue} />
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
