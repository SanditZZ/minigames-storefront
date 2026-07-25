import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "solid" | "quiet";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition active:scale-95 " +
  "disabled:opacity-50 disabled:active:scale-100 " +
  // Visible keyboard focus everywhere, without a focus ring on pointer taps.
  "outline-none focus-visible:ring-4 focus-visible:ring-brand/50";

// Colours come only from the shared palette tokens (see frontend/CLAUDE.md).
const variants: Record<Variant, string> = {
  primary: "bg-brand text-ink shadow-lg", // Coral CTA with ink label
  solid: "bg-ink text-brand-4 shadow-lg", // strong dark button, cream label
  ghost: "bg-ink/10 text-ink hover:bg-ink/15",
  quiet: "text-ink/60 hover:text-ink", // low-emphasis, borderless
};

// Every size clears a 44px tap target at its default line-height.
const sizes = {
  sm: "min-h-11 px-4 py-2 text-sm",
  md: "min-h-12 px-5 py-2.5 text-base",
  lg: "min-h-14 px-8 py-3 text-lg",
} as const;

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: keyof typeof sizes;
  /** Stretches the button to its container — the default for stacked CTAs. */
  fullWidth?: boolean;
}

/** The one button used across every player screen and game. */
export function Button({ variant = "primary", size = "md", fullWidth = false, className = "", ...rest }: Props) {
  return (
    <button
      type="button"
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    />
  );
}
