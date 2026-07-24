import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

// Shared admin UI kit. Same palette tokens as the player app; keep all admin
// screens consistent by composing these instead of restyling markup inline.

const control =
  "w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand";

type BtnVariant = "primary" | "ghost" | "danger";
const btnBase = "inline-flex items-center justify-center rounded-lg font-semibold transition disabled:opacity-50";
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

export function Field({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-ink/80">{label}</span>
      {children}
    </label>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/5 ${className}`}>{children}</div>;
}

export function Badge({ tone = "neutral", children }: { tone?: "on" | "off" | "neutral"; children: ReactNode }) {
  const tones = {
    on: "bg-brand text-ink",
    off: "bg-ink/10 text-ink/60",
    neutral: "bg-brand-3 text-ink",
  } as const;
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}
