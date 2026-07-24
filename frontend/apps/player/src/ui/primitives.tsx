import type { ReactNode } from "react";

/** Full-screen themed backdrop that hosts the whole player app. The warm
 *  cream→apricot gradient lives here so every screen and game share one canvas. */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-gradient-to-b from-brand-4 to-brand-3">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col p-5">{children}</div>
    </div>
  );
}

/** A content card. `tone` switches between an opaque white card and a soft
 *  translucent surface — both carry ink text per the palette rules. */
export function Card({ tone = "solid", className = "", children }: { tone?: "solid" | "muted"; className?: string; children: ReactNode }) {
  const toneCls =
    tone === "solid" ? "bg-white text-ink shadow-xl" : "bg-white/60 text-ink ring-1 ring-ink/5";
  return <div className={`rounded-2xl p-4 ${toneCls} ${className}`}>{children}</div>;
}

/** Big numeric readout (score, taps, time) — one style everywhere. */
export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="text-center">
      <div className="text-6xl font-black tabular-nums text-ink">{value}</div>
      <div className="mt-1 text-sm font-medium uppercase tracking-widest text-ink/60">{label}</div>
    </div>
  );
}

/** Horizontal progress/timer bar. `pct` is 0–100. */
export function ProgressBar({ pct, caption }: { pct: number; caption?: ReactNode }) {
  return (
    <div className="w-full max-w-xs">
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink/10">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-75 ease-linear"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
      {caption != null && <div className="mt-2 text-center text-sm tabular-nums text-ink/70">{caption}</div>}
    </div>
  );
}

/** Centred spinner + optional label, for loading/transitional states. */
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-ink/20 border-t-brand" />
      {label && <p className="text-ink/70">{label}</p>}
    </div>
  );
}

/** Vertically-centred column, the default layout for game/interstitial content. */
export function CenterStack({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-6">{children}</div>;
}
