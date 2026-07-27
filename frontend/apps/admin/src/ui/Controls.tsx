import {
  canStep,
  clampNumber,
  parseNumber,
  stepNumber,
  unitLabel,
  type DurationUnit,
  type DurationValue,
  type NumberBounds,
} from "@minigames/admin-core";
import { useCallback, useEffect, useRef, useState } from "react";
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
 * How long a held stepper waits before repeating, and how fast it then goes.
 *
 * The delay is what keeps a single press from becoming two; the interval is what
 * makes a stepper usable past about five presses, which is the point where an
 * operator setting a stock of 40 gives up and reaches for the keyboard.
 */
const REPEAT_DELAY_MS = 400;
const REPEAT_EVERY_MS = 60;

/**
 * THE number input for the whole admin. Nothing else should render
 * `<input type="number">`.
 *
 * It exists because the native spinner is unusable and, on a phone, absent. Those
 * two arrows are roughly a 10px target stacked two-high — a straight failure of
 * this project's own 44px rule — and mobile browsers do not draw them at all, so
 * on the device an operator at a counter actually has, a "number" field is a plain
 * box with no way to nudge it. `appearance-none` removes them and the optional
 * `+`/`−` buttons replace them at a real size.
 *
 * Four behaviours it centralises, each of which was a bug in at least one form:
 *
 *   - **A cleared field is not zero.** The draft text is held here as a STRING
 *     and only parsed on the way out, so backspacing to retype reports `null`
 *     rather than silently proposing 0 — see parseNumber, and the trap it pins.
 *   - **Clamping happens on COMMIT, not per keystroke.** Snapping "12" to a grid
 *     while someone is still typing "125" fights them for the field, so `onChange`
 *     reports what was typed and blur reports what is allowed.
 *   - **The wheel does not touch a focused field.** A number input silently
 *     changing while the page scrolls under the cursor is a data-loss bug, not a
 *     convenience; the field blurs instead of accepting the scroll.
 *   - **`inputMode="numeric"`** everywhere, so a phone offers a number pad.
 *
 * `label` is REQUIRED and names the VALUE, not the control — "Stock", not "Stock
 * amount". With steppers this composes THREE controls behind one caller-supplied
 * name, and a wrapping `<label>` only ever associates with the first of them, so
 * each derives its own accessible name here. That is the rule `ColorInput` and
 * `DurationInput` already follow and the reason it is not optional: see
 * frontend/CLAUDE.md.
 *
 * Steppers are OPT-IN. `+`/`−` is right for a stock count or a sort order and
 * silly beside a value of 168, which is why the caller decides and supplies the
 * `step` rather than the component assuming one.
 */
export function NumberInput({
  label,
  value,
  onChange,
  bounds = {},
  steppers = false,
  suffix,
  placeholder,
  className = "",
}: {
  /** What the number IS, e.g. "Stock". Required: see above. */
  label: string;
  /** The committed value, or null for an empty field. */
  value: number | null;
  onChange: (value: number | null) => void;
  bounds?: NumberBounds;
  /** Render `+`/`−` buttons. Opt-in: a step has to mean something first. */
  steppers?: boolean;
  /** The unit, shown inside the field ("ms", "taps/second"). */
  suffix?: ReactNode;
  placeholder?: string;
  className?: string;
}) {
  // The text being typed, which is NOT the value: "" and "-" are both legitimate
  // things to hold mid-edit and neither is a number. Null means "not editing —
  // show whatever the value prop says", which is what lets a parent-driven change
  // (a stepper, a reset, a fresh row) reach the box while it is untouched.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? (value === null ? "" : String(value));

  const commit = useCallback(() => {
    setDraft(null);
    const parsed = parseNumber(text);
    const next = parsed === null ? null : clampNumber(parsed, bounds);
    if (next !== value) onChange(next);
  }, [text, value, onChange, bounds]);

  const nudge = useCallback(
    (direction: 1 | -1) => onChange(stepNumber(parseNumber(text), direction, bounds)),
    [text, onChange, bounds],
  );

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {steppers && (
        <StepperButton label={`Decrease ${label}`} disabled={!canStep(parseNumber(text), -1, bounds)} onPress={() => nudge(-1)}>
          −
        </StepperButton>
      )}
      {/* The suffix sits INSIDE the field's box rather than after it, so "ms"
          reads as part of the value instead of as loose text the eye has to
          associate. `pr-*` on the input reserves room for it; the span is
          pointer-transparent so a tap near the unit still focuses the field. */}
      <div className="relative min-w-0 flex-1">
        <input
          type="number"
          inputMode="numeric"
          aria-label={label}
          value={text}
          placeholder={placeholder}
          min={bounds.min}
          max={bounds.max}
          step={bounds.step}
          onChange={(e) => {
            setDraft(e.target.value);
            const parsed = parseNumber(e.target.value);
            // Reported UNCLAMPED: this is "what they typed". Blur decides what is
            // allowed, so a half-entered value is never snapped under the cursor.
            if (parsed !== value) onChange(parsed);
          }}
          onBlur={commit}
          // See the class comment: a focused number input must not absorb a page
          // scroll. Blurring rather than merely preventing the default is the
          // version that also stops the SECOND scroll, once the cursor has moved
          // on but focus has not.
          onWheel={(e) => e.currentTarget.blur()}
          className={`${control} appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
            suffix ? "pr-12" : ""
          }`}
        />
        {suffix != null && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink/50">
            {suffix}
          </span>
        )}
      </div>
      {steppers && (
        <StepperButton label={`Increase ${label}`} disabled={!canStep(parseNumber(text), 1, bounds)} onPress={() => nudge(1)}>
          +
        </StepperButton>
      )}
    </div>
  );
}

/**
 * One stepper button, which repeats while held.
 *
 * Press-and-hold is the whole reason this is not just a `Button`: a stepper that
 * fires once per press is fine for three presses and abandoned by the tenth. The
 * repeat runs on a timer started at `pointerdown` and cleared on pointerup,
 * pointerleave, pointercancel and unmount — all four, because a pointer that
 * leaves the button or a component that disappears mid-hold would otherwise leave
 * an interval incrementing a value nobody is watching.
 *
 * `size-11` is 44px, the project's tap-target floor, which is the number the
 * native spinner this replaces misses by a factor of four.
 */
function StepperButton({
  label,
  disabled,
  onPress,
  children,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const timers = useRef<{ delay?: number; repeat?: number }>({});

  const stop = useCallback(() => {
    window.clearTimeout(timers.current.delay);
    window.clearInterval(timers.current.repeat);
    timers.current = {};
  }, []);

  // The hold is torn down on unmount too: a form that closes mid-press must not
  // leave a timer behind calling onPress into a component that is gone.
  useEffect(() => stop, [stop]);

  // A ref, so the interval always calls the CURRENT onPress. Captured once it
  // would keep stepping from the value the press started at, and a held button
  // would move the number by exactly one step however long it was held.
  const press = useRef(onPress);
  press.current = onPress;

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={() => {
        press.current();
        timers.current.delay = window.setTimeout(() => {
          timers.current.repeat = window.setInterval(() => press.current(), REPEAT_EVERY_MS);
        }, REPEAT_DELAY_MS);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      className={`${btnBase} size-11 shrink-0 border border-ink/15 bg-white text-lg text-ink hover:bg-ink/5`}
    >
      {children}
    </button>
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
          {/* Built on NumberInput rather than hand-rolling the arithmetic: the
              `Math.max(0, Math.floor(Number(e.target.value) || 0))` this replaces
              was the same clamp, inline and untested, and it turned a cleared
              field into 0 mid-keystroke. No steppers — a claim window of 168
              hours is not a value anyone nudges one at a time, and the unit
              dropdown beside it is already two controls' worth of row. */}
          <NumberInput
            label={name("amount")}
            bounds={{ min: 0, step: 1 }}
            value={value.amount}
            onChange={(amount) => onChange({ ...value, amount: amount ?? 0 })}
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
