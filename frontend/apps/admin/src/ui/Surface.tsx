import type { ReactNode } from "react";

// Surfaces and inline states shared by every admin panel.

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/5 ${className}`}>{children}</div>;
}

export function Badge({ tone = "neutral", children }: { tone?: "on" | "off" | "neutral"; children: ReactNode }) {
  const tones = {
    on: "bg-brand text-ink",
    off: "bg-ink/10 text-ink/60",
    neutral: "bg-brand-3 text-ink",
  } as const;
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>
  );
}

/** The one error banner. Rendering nothing for an empty message keeps call
 *  sites free of `{error && …}` noise. */
export function Alert({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  );
}

/** Inline "still fetching" line, used while a panel's list is null. */
export function Loading({ label = "Loading…" }: { label?: string }) {
  return <p className="text-ink/50">{label}</p>;
}

/** A card explaining why a list is empty, instead of a blank area. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <Card>
      <p className="text-ink/60">{children}</p>
    </Card>
  );
}
