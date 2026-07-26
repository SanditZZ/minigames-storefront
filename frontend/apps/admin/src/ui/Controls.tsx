import { unitLabel, type DurationUnit, type DurationValue } from "@minigames/admin-core";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

// Form controls for the admin app. Same palette tokens as the player app; keep
// all admin screens consistent by composing these instead of restyling markup.

const control =
  "w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand";

type BtnVariant = "primary" | "ghost" | "danger";
const btnBase =
  "inline-flex items-center justify-center rounded-lg font-semibold transition disabled:opacity-50 " +
  "outline-none focus-visible:ring-2 focus-visible:ring-brand";
const btnVariants: Record<BtnVariant, string> = {
  primary: "bg-brand text-ink hover:bg-brand-2 px-4 py-2",
  ghost: "text-ink/70 hover:bg-ink/5 px-4 py-2",
  danger: "text-red-700 hover:bg-red-50 px-3 py-2",
};

export function Button({
  variant = "primary",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return <button className={`${btnBase} ${btnVariants[variant]} ${className}`} {...rest} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${control} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${control} ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${control} ${props.className ?? ""}`} />;
}

/** A labelled checkbox — the one styling for every boolean in the admin. */
export function Checkbox({
  label,
  checked,
  onChange,
  className = "",
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <label className={`flex items-center gap-2 text-sm text-ink/80 ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-brand"
      />
      {label}
    </label>
  );
}

/**
 * A colour value: the OS picker and the hex it produced, side by side.
 *
 * Both are editable on purpose. The swatch is how anyone picks a colour; the
 * text field is how a brand colour that already exists on a letterhead gets
 * typed in exactly, which a picker makes needlessly hard. The text field is
 * also the only one that can express "unset" — `<input type="color">` has no
 * empty state and answers `#000000` when asked, so a store that has overridden
 * nothing would silently acquire a black palette the moment the picker rendered.
 * `placeholder` carries the token default for that reason.
 *
 * `label` names the COLOUR, not the control — "Coral", not "Coral hex value".
 * Both inputs then name themselves from it, and they have to: a wrapping
 * `<label>` associates with the FIRST labelable descendant only, so the swatch
 * was taking the Field's name and the hex box was getting none at all. Five
 * colours on the branding form meant five identically-named pickers and five
 * anonymous text boxes — a screen reader user could hear which control they
 * were on and never which colour it set.
 */
export function ColorInput({
  value,
  placeholder,
  onChange,
  label,
}: {
  value: string;
  /** The token default shown when nothing is set — never submitted. */
  placeholder: string;
  onChange: (value: string) => void;
  /** The colour's own name, e.g. "Coral". Required: see above. */
  label: string;
}) {
  const swatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()) ? value.trim() : placeholder;

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={`Pick ${label}`}
        value={swatch}
        onChange={(e) => onChange(e.target.value)}
        className="size-10 shrink-0 cursor-pointer rounded-lg border border-ink/15 bg-white p-1"
      />
      <Input
        value={value}
        aria-label={`${label} hex value`}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 font-mono"
      />
    </div>
  );
}

/**
 * A length of time, entered as an amount and the unit it is counted in.
 *
 * It exists because the raw setting is unreadable: `claim_ttl_hours` stores
 * `168`, and an operator who wants "one week" has to know that is 168 while one
 * who reads 168 has to divide. The stored unit is part of the key's name and of
 * what the backend reads, so it is the DISPLAY that changes here and never the
 * value — every conversion is a pure function in `@minigames/admin-core`
 * (`duration.ts`), and the line underneath always names the number actually
 * being saved.
 *
 * The unit shown on load is the coarsest one that divides the stored value
 * evenly, so 168 opens as "7 days" and 36 opens as "36 hours" rather than as a
 * fraction nobody typed. Switching the unit dropdown REINTERPRETS the amount
 * rather than converting it — picking "days" beside a 36 means thirty-six days,
 * which is the only reading that matches what the operator is looking at.
 *
 * Layout follows the project's anti-overlap rule: the parent owns the gap, the
 * number takes `min-w-0 flex-1` so it shrinks, and the unit select is
 * `shrink-0` so it never collapses or wraps mid-word on a 320px screen.
 */
export function DurationInput({
  value,
  units,
  note,
  label,
  onChange,
}: {
  value: DurationValue;
  units: readonly DurationUnit[];
  /** The stored value in words, shown underneath ("168 hours"). */
  note?: ReactNode;
  /**
   * What this duration IS, e.g. `claim_ttl_hours`. Optional, and worth passing
   * whenever more than one duration can be on screen: without it both halves
   * are named "Amount" and "Unit", which is unambiguous for the eye (the key is
   * printed above them) and not for a screen reader, which reads controls out
   * of context and would hear the same four names twice over.
   */
  label?: string;
  onChange: (value: DurationValue) => void;
}) {
  const name = (part: string) => (label ? `${label} ${part}` : part.replace(/^./, (c) => c.toUpperCase()));
  return (
    <div>
      {/* The sizing lives on WRAPPERS, not on the controls. `Input` and
          `Select` both carry `w-full` from the shared control class, and a
          `w-auto`/`flex-1` added on top of that is decided by Tailwind's own
          rule order rather than by the order written here — which is how the
          number field ended up collapsed to a sliver while the unit select
          took the whole row. Wrappers cannot lose that argument. */}
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            aria-label={name("amount")}
            value={String(value.amount)}
            onChange={(e) => onChange({ ...value, amount: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
          />
        </div>
        {/* Wide enough for the longest unit word plus the native arrow, so the
            control never wraps mid-word or clips its own label at 320px. */}
        <div className="w-32 shrink-0">
          <Select
            aria-label={name("unit")}
            value={value.unit}
            onChange={(e) => onChange({ ...value, unit: e.target.value as DurationUnit })}
          >
            {units.map((unit) => (
              <option key={unit} value={unit}>
                {unitLabel(unit, value.amount)}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {note != null && <p className="mt-1 text-xs text-ink/50">{note}</p>}
    </div>
  );
}

export function Field({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-ink/80">{label}</span>
      {children}
    </label>
  );
}
