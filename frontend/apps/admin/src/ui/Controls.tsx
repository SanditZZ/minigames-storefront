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
 */
export function ColorInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  /** The token default shown when nothing is set — never submitted. */
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const swatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()) ? value.trim() : placeholder;

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label="Pick a colour"
        value={swatch}
        onChange={(e) => onChange(e.target.value)}
        className="size-10 shrink-0 cursor-pointer rounded-lg border border-ink/15 bg-white p-1"
      />
      <Input
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 font-mono"
      />
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
