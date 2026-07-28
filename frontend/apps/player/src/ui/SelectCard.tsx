import type { ReactNode } from "react";

/**
 * A large, tappable card used to choose something (currently: a game).
 *
 * Layout follows the project's anti-overlap rule — the row owns the gap, the
 * text block truncates via `min-w-0 flex-1`, and the trailing action never
 * shrinks or wraps — so a long game name can't push the button off a 320px
 * screen.
 */
export function SelectCard({
  title,
  subtitle,
  action,
  media,
  disabled = false,
  onClick,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Trailing label, e.g. "Play" or "Soon". */
  action: ReactNode;
  /** Optional leading icon. */
  media?: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-lg outline-none transition active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-brand/50 disabled:opacity-50 disabled:active:scale-100"
    >
      {media != null && (
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-4 text-2xl" aria-hidden>
          {media}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-bold text-ink">{title}</span>
        {subtitle != null && <span className="line-clamp-2 block text-sm text-ink/60">{subtitle}</span>}
      </span>
      <span
        className={`shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold ${
          disabled ? "bg-ink/10 text-ink/60" : "bg-brand text-ink"
        }`}
      >
        {action}
      </span>
    </button>
  );
}

/**
 * One leaderboard line: rank, name, value. `highlighted` marks the player's own
 * row so they can find themselves without reading every entry.
 */
export function ScoreRow({
  rank,
  name,
  value,
  unit,
  highlighted = false,
}: {
  rank: number;
  name: string;
  value: number;
  unit: string;
  highlighted?: boolean;
}) {
  return (
    <li
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
        highlighted ? "bg-brand font-semibold text-ink" : "text-ink/80"
      }`}
      aria-current={highlighted ? "true" : undefined}
    >
      <span className="w-6 shrink-0 text-center font-bold tabular-nums">{rank}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
      <span className="shrink-0 whitespace-nowrap font-bold tabular-nums">
        {value} {unit}
      </span>
    </li>
  );
}
