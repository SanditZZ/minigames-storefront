import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "solid" | "quiet";

const base =
  "inline-flex items-center justify-center gap-2 font-bold transition active:scale-95 " +
  "disabled:opacity-50 disabled:active:scale-100 " +
  // Visible keyboard focus everywhere, without a focus ring on pointer taps.
  "outline-none focus-visible:ring-4 focus-visible:ring-brand/50";

// Colours come only from the shared palette tokens (see frontend/CLAUDE.md).
// The corner treatment moved out of `base` so `primary` can swap it for the
// ticket family's cut corner (`.cta-notch`, in index.css) instead of fighting
// a `rounded-xl` utility of the same specificity.
const variants: Record<Variant, string> = {
  primary: "cta-notch bg-brand text-ink shadow-lg", // Coral CTA with ink label
  solid: "rounded-xl bg-ink text-brand-4 shadow-lg", // strong dark button, cream label
  ghost: "rounded-xl bg-ink/10 text-ink hover:bg-ink/15",
  quiet: "rounded-xl text-ink/60 hover:text-ink", // low-emphasis, borderless
};

// Same colours, without a baked-in corner treatment — IconButton always
// applies its own circular "coin" shape instead (see below).
const iconVariants: Record<Variant, string> = {
  primary: "bg-brand text-ink shadow-lg",
  solid: "bg-ink text-brand-4 shadow-lg",
  ghost: "bg-ink/10 text-ink hover:bg-ink/15",
  quiet: "text-ink/60 hover:text-ink",
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

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  variant?: Variant;
  /**
   * The accessible name. Required, not optional: an icon-only control whose
   * only label is a glyph is unreadable to a screen reader, and making the
   * prop mandatory is the only version of that rule a compiler can enforce.
   */
  label: string;
}

/**
 * A circular, icon-only "coin/token" button — 44px across, so it clears the
 * tap target minimum. `ring-inset` draws the coin's rim inside the circle so
 * it never depends on matching whatever happens to sit behind the button.
 */
export function IconButton({ variant = "ghost", label, className = "", children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`${base} rounded-full ring-2 ring-inset ring-ink/15 ${iconVariants[variant]} size-11 text-lg ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
