import type { Tier } from "../reveal/tiers";

interface Props {
  /** Current puck height, 0–100 (% of the tower). */
  heightPct: number;
  /** Ladder printed beside the tower. */
  tiers: Tier[];
  /** The tier the puck is currently in — highlighted in the ladder. */
  activeTier: Tier;
  /** Lights the bell at the top (a new record). */
  bellLit: boolean;
}

/**
 * The arcade strength-tester tower used to reveal a score.
 *
 * Presentational only: it renders whatever height it is given, so the timing,
 * easing and overshoot all stay in reveal/calc.ts where they can be tested.
 * The whole thing is aria-hidden — the score is announced as text by the screen
 * that owns it, so a screen-reader user hears the number instead of a meter.
 */
export function RevealMeter({ heightPct, tiers, activeTier, bellLit }: Props) {
  return (
    <div className="flex h-72 w-full max-w-xs items-stretch gap-4" aria-hidden>
      {/* Tower */}
      <div className="relative w-20 shrink-0">
        {/* Bell at the summit */}
        <div
          className={`absolute -top-1 left-1/2 z-10 grid h-11 w-11 -translate-x-1/2 -translate-y-full place-items-center rounded-full text-xl shadow-lg ${
            bellLit ? "bg-brand animate-flash" : "bg-white"
          }`}
        >
          🔔
        </div>

        <div className="relative h-full overflow-hidden rounded-2xl bg-white/70 ring-1 ring-ink/10">
          {/* Fill */}
          <div
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-3 via-brand-2 to-brand"
            style={{ height: `${heightPct}%` }}
          />
          {/* Tick marks up the tower */}
          {tiers.map((t) => (
            <div
              key={t.label}
              className="absolute inset-x-0 border-t border-dashed border-ink/15"
              style={{ bottom: `${t.from * 100}%` }}
            />
          ))}
          {/* Puck — the slider the punch drives up the rail */}
          <div
            className="absolute inset-x-0 transition-none"
            style={{ bottom: `calc(${heightPct}% - 0.4rem)` }}
          >
            <div className="mx-auto h-3 w-[115%] rounded-full bg-ink shadow-md" />
          </div>
        </div>
      </div>

      {/* Rating ladder */}
      <div className="relative min-w-0 flex-1">
        {tiers.map((t) => {
          const active = t.label === activeTier.label;
          return (
            <div
              key={t.label}
              className="absolute inset-x-0 flex translate-y-1/2 items-center gap-2"
              style={{ bottom: `${t.from * 100}%` }}
            >
              <span className={`h-px w-3 shrink-0 ${active ? "bg-brand" : "bg-ink/20"}`} />
              <span className="shrink-0 text-base">{t.icon}</span>
              <span
                className={`min-w-0 truncate text-sm ${
                  active ? "font-black text-ink" : "font-medium text-ink/40"
                }`}
              >
                {t.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
