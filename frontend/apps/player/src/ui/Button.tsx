import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "solid";

const base =
  "inline-flex items-center justify-center rounded-xl font-bold transition active:scale-95 disabled:opacity-50 disabled:active:scale-100";

// Colours come only from the shared palette tokens (see frontend/CLAUDE.md).
const variants: Record<Variant, string> = {
  primary: "bg-brand text-ink shadow-lg", // Coral CTA with ink label
  solid: "bg-ink text-brand-4 shadow-lg", // strong dark button, cream label
  ghost: "bg-ink/10 text-ink hover:bg-ink/15",
};

const sizes = {
  md: "px-5 py-2.5 text-base",
  lg: "px-8 py-3 text-lg",
} as const;

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: keyof typeof sizes;
}

/** The one button used across every player screen and game. */
export function Button({ variant = "primary", size = "md", className = "", ...rest }: Props) {
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest} />;
}
