import type { ReactNode } from "react";

/**
 * A tappable tile used to choose something (currently: a game), sized for a
 * 2-column grid rather than a single-column list.
 *
 * The icon badge is a coin/token circle (rounded-full + an inset ring) to
 * match the icon-button treatment used everywhere else — see
 * frontend/CLAUDE.md. `mt-auto` on the trailing action pins it to the bottom
 * of the tile regardless of how many lines the subtitle wraps to, so every
 * card in a row keeps its action pill aligned with its neighbours'.
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
      className="flex h-full w-full flex-col items-center gap-2 rounded-2xl bg-white p-4 text-center shadow-lg outline-none transition active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-brand/50 disabled:opacity-50 disabled:active:scale-100"
    >
      {media != null && (
        <span
          className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-4 text-2xl ring-2 ring-inset ring-ink/15"
          aria-hidden
        >
          {media}
        </span>
      )}
      <span className="w-full min-w-0">
        <span className="block truncate text-base font-bold text-ink">{title}</span>
        {subtitle != null && <span className="line-clamp-2 block text-xs text-ink/60">{subtitle}</span>}
      </span>
      <span
        className={`mt-auto whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-bold ${
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
  size = "sm",
}: {
  rank: number;
  name: string;
  value: number;
  unit: string;
  highlighted?: boolean;
  /** "lg" is the TV/kiosk display's full-bleed board — see DisplayScreen. */
  size?: "sm" | "lg";
}) {
  const lg = size === "lg";
  return (
    <li
      className={`flex items-center gap-3 rounded-lg ${lg ? "px-5 py-4 text-2xl sm:text-3xl" : "px-3 py-2 text-sm"} ${
        highlighted ? "bg-brand font-semibold text-ink" : "text-ink/80"
      }`}
      aria-current={highlighted ? "true" : undefined}
    >
      {/* `min-w` rather than `w`: the column has to stay wide enough to keep
          every rank aligned, and a pinned row is where three digits finally
          show up — a #128 in a fixed slot overflows its own cell.
          `rounded-full` on a box that can grow past a circle becomes a pill
          instead — still the same coin/token language as everywhere else,
          without the three-digit overflow a fixed circle would reintroduce. */}
      <span
        className={`grid shrink-0 place-items-center rounded-full bg-ink/10 text-center font-bold tabular-nums ${
          lg ? "min-w-14 px-2 py-1" : "min-w-6 px-1.5 py-0.5"
        }`}
      >
        {rank}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
      <span className="shrink-0 whitespace-nowrap font-bold tabular-nums">
        {value} {unit}
      </span>
    </li>
  );
}

/**
 * The elision between a leaderboard's visible window and a row pinned below it.
 *
 * `aria-hidden` because it carries no information a screen reader needs: the
 * jump from rank 10 to rank 23 is already spoken by the two rank numbers on
 * either side of it, and "horizontal ellipsis" is not a useful thing to hear
 * in the middle of a table. Sighted readers get the same fact from the shape.
 */
export function ScoreGapRow({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <li
      className={`px-3 text-center font-bold leading-none text-ink/25 ${size === "lg" ? "text-2xl" : "text-sm"}`}
      aria-hidden
    >
      ···
    </li>
  );
}
