import type { ReactNode } from "react";
import { Button } from "./Controls";

// Surfaces and inline states shared by every admin panel.

type Shape = "panel" | "ticket";

// "ticket" adds the die-cut ticket-stub cutout (.ticket-shape, in index.css)
// — used for the claims panel. Everything else stays a plain rounded card.
const shapes: Record<Shape, string> = {
  panel: "",
  ticket: "ticket-shape",
};

export function Card({
  shape = "panel",
  className = "",
  children,
}: {
  shape?: Shape;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/5 ${shapes[shape]} ${className}`}>
      {children}
    </div>
  );
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

/**
 * The one banner. Rendering nothing for an empty message keeps call sites free
 * of `{error && …}` noise.
 *
 * Two tones, and the difference is whether the operator is BLOCKED. An `error`
 * sits beside a disabled Save — something must change before this can proceed.
 * A `warning` sits beside a live one: the app has an opinion, the operator may
 * overrule it, and the save goes through either way. Giving them the same red
 * would teach an operator to read past both.
 *
 * `role` follows the tone rather than being fixed at "alert": a screen reader
 * interrupting for advice the operator is free to ignore is the audible version
 * of the same mistake.
 */
export function Alert({ message, tone = "error" }: { message?: string; tone?: "error" | "warning" }) {
  if (!message) return null;
  const tones = {
    error: "bg-red-50 text-red-700",
    warning: "bg-brand-3/40 text-ink",
  } as const;
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-lg px-3 py-2 text-sm ${tones[tone]}`}>
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
