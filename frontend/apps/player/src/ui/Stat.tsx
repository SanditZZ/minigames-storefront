import type { ReactNode } from "react";
import { Eyebrow } from "./Card";

const sizes = {
  md: "text-4xl",
  lg: "text-6xl",
  xl: "text-7xl",
} as const;

/** Big numeric readout (score, taps, time) — one style everywhere. */
export function Stat({
  value,
  label,
  size = "lg",
  className = "",
}: {
  value: ReactNode;
  label: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <div className={`text-center ${className}`}>
      <div className={`${sizes[size]} font-black tabular-nums leading-none text-ink`}>{value}</div>
      <Eyebrow className="mt-2">{label}</Eyebrow>
    </div>
  );
}

/** Horizontal progress/timer bar. `pct` is 0–100. */
export function ProgressBar({ pct, caption, label }: { pct: number; caption?: ReactNode; label?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="w-full max-w-xs">
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-ink/10"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-75 ease-linear"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {caption != null && <div className="mt-2 text-center text-sm tabular-nums text-ink/70">{caption}</div>}
    </div>
  );
}

/** Small pill used for status/labels (rank, "new best", stock). */
export function Badge({ tone = "brand", children }: { tone?: "brand" | "muted"; children: ReactNode }) {
  const tones = {
    brand: "bg-brand text-ink",
    muted: "bg-ink/10 text-ink/70",
  } as const;
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${tones[tone]}`}>{children}</span>
  );
}
