import type { ReactNode } from "react";
import { Card } from "./Surface";

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
