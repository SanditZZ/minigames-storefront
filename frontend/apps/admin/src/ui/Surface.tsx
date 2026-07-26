import type { ReactNode } from "react";
import { Button } from "./Controls";

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

/**
 * An in-place "are you sure" step: a question, its consequence, and two buttons.
 *
 * Deliberately NOT `window.confirm`. Three reasons, in order of how much they
 * cost: a native dialog cannot show the prize name in the app's own type, it
 * blocks the page (which in a browser-automation session means the whole tab
 * stops responding — see the repo's note about modal dialogs), and it is
 * unstyleable, so the most consequential control in the admin would be the one
 * thing that looks like it belongs to another program.
 *
 * The confirming button is NOT autofocused. This is the step that exists because
 * a camera can fire a redemption at the wrong moment, so "press enter twice
 * quickly" must not complete a hand-over either.
 */
export function ConfirmPrompt({
  question,
  note,
  verb,
  busy = false,
  onConfirm,
  onCancel,
}: {
  question: string;
  note: string;
  verb: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div role="group" aria-label="Confirm" className="mt-3 rounded-xl bg-brand-4 p-4 ring-1 ring-ink/10">
      <p className="text-sm font-bold text-ink">{question}</p>
      <p className="mt-1 text-sm text-ink/70">{note}</p>
      {/* gap-3 and wrapping: two labelled buttons plus a long prize name do not
          fit one 320px row, and a confirm control that overflows is worse than
          one that stacks. */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={onConfirm} disabled={busy} className="shrink-0 whitespace-nowrap">
          {busy ? "Working…" : verb}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy} className="shrink-0 whitespace-nowrap">
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** A card explaining why a list is empty, instead of a blank area. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <Card>
      <p className="text-ink/60">{children}</p>
    </Card>
  );
}
