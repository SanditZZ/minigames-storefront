import type { InputHTMLAttributes } from "react";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  label: string;
  /** Hides the label visually but keeps it for screen readers. */
  hideLabel?: boolean;
}

/** The one text input in the player app: label + control, themed and accessible. */
export function TextField({ label, hideLabel = false, ...rest }: Props) {
  return (
    <label className="block">
      <span className={hideLabel ? "sr-only" : "mb-1 block text-sm font-semibold text-ink/80"}>{label}</span>
      <input
        {...rest}
        className="w-full rounded-xl border-0 bg-white px-4 py-3 text-lg text-ink placeholder-ink/40 outline-none ring-2 ring-transparent focus:ring-brand"
      />
    </label>
  );
}
