import type { ReactNode } from "react";
import type { ClaimView } from "@minigames/api-client";
import { claimStatusLabel, claimStatusTone } from "@minigames/admin-core";
import { Button } from "./Controls";
import { Badge, Card } from "./Surface";

/** Page frame: tinted background plus the centred content column. */
export function AppShell({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-full bg-brand-4">
      <header className="border-b border-ink/10 bg-white">{header}</header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}

/**
 * Title bar with a trailing action.
 *
 * Same anti-overlap contract as the player app: the row owns the gap, the title
 * truncates via `min-w-0 flex-1`, and the action carries `shrink-0
 * whitespace-nowrap` so it can never be squeezed or wrapped on a narrow screen.
 */
export function TopBar({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
      <h1 className="min-w-0 flex-1 truncate text-lg font-black text-ink">{title}</h1>
      {action != null && <div className="shrink-0 whitespace-nowrap">{action}</div>}
    </div>
  );
}

/** Underlined tab strip. Generic over the tab id so callers stay type-safe. */
export function Tabs<T extends string>({
  tabs,
  active,
  onSelect,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onSelect: (id: T) => void;
}) {
  return (
    <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-current={t.id === active ? "page" : undefined}
          onClick={() => onSelect(t.id)}
          className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition ${
            t.id === active ? "border-brand text-ink" : "border-transparent text-ink/50 hover:text-ink"
          }`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

/** Panel heading with an optional action — used by every CRUD panel. */
export function PanelHeader({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="min-w-0 flex-1 truncate text-lg font-bold text-ink">{title}</h2>
      {action != null && <div className="shrink-0 whitespace-nowrap">{action}</div>}
    </div>
  );
}

/** Vertical stack with the panels' standard rhythm. */
export function Stack({ gap = "md", className = "", children }: { gap?: "sm" | "md"; className?: string; children: ReactNode }) {
  return <div className={`flex flex-col ${gap === "sm" ? "gap-3" : "gap-4"} ${className}`}>{children}</div>;
}

/**
 * One claim in the claims list.
 *
 * Same anti-overlap contract as every other row here: the row owns the gap, the
 * text block is `min-w-0 flex-1` so a long prize name truncates instead of
 * shoving the action off-screen, and the action is `shrink-0 whitespace-nowrap`.
 * At 320px this row carries a code, a prize name, a badge and a button, so it
 * is the one most likely to break the rule if edited carelessly.
 *
 * `status` is passed through from the API, never recomputed — see ClaimView.
 */
export function ClaimRow({
  view,
  busy = false,
  onRedeem,
  onUnredeem,
}: {
  view: ClaimView;
  busy?: boolean;
  onRedeem: () => void;
  /** Undo a collection. Rendered only on a redeemed row. */
  onUnredeem: () => void;
}) {
  const { claim, status } = view;
  return (
    <li className="flex items-center gap-3 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold tracking-wider text-ink">{claim.code}</span>
          <Badge tone={claimStatusTone(status)}>{claimStatusLabel(status)}</Badge>
        </div>
        <div className="mt-0.5 truncate text-ink/60">{claim.awardName}</div>
      </div>
      {status === "issued" && (
        // The visible label is "Redeem" on every row, which is right on screen
        // (the code is right there) and useless to a screen reader, which reads
        // controls out of context — a panel of identical "Redeem" buttons plus
        // the lookup box's own. The accessible name carries the code instead.
        <Button
          onClick={onRedeem}
          disabled={busy}
          aria-label={`Redeem claim ${claim.code}`}
          className="shrink-0 whitespace-nowrap"
        >
          Redeem
        </Button>
      )}
      {status === "redeemed" && (
        // The repair for a mis-scan, on the only rows where it means anything.
        // `ghost` rather than `danger`: undoing a collection is a correction, not
        // a destruction — nothing is lost, and styling it as a hazard would make
        // staff hesitate over the button that fixes their mistake.
        <Button
          variant="ghost"
          onClick={onUnredeem}
          disabled={busy}
          aria-label={`Undo collection of claim ${claim.code}`}
          className="shrink-0 whitespace-nowrap"
        >
          Undo
        </Button>
      )}
    </li>
  );
}

/** One leaderboard line in the admin scores view. */
export function RankRow({ rank, name, value, unit }: { rank: number; name: string; value: number; unit: string }) {
  return (
    <li className="flex items-center gap-3 py-2 text-sm">
      <span className="w-6 shrink-0 text-center font-bold tabular-nums text-ink/50">{rank}</span>
      <span className="min-w-0 flex-1 truncate font-medium text-ink">{name}</span>
      <span className="shrink-0 whitespace-nowrap font-bold tabular-nums text-ink">
        {value} {unit}
      </span>
    </li>
  );
}

/** Centred single-card layout, used by the sign-in gate. */
export function CenteredCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-brand-4 p-4">
      <Card className="w-full max-w-sm">{children}</Card>
    </div>
  );
}
