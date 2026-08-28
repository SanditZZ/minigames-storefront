import type { Tier } from "@minigames/player-core";
import { useT } from "../i18n";
import { Icon } from "./Icon";

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
 * easing and overshoot all stay in @minigames/player-core where they are tested.
 * The whole thing is aria-hidden — the score is announced as text by the screen
 * that owns it, so a screen-reader user hears the number instead of a meter.
 *
 * The ladder's rungs arrive as message keys and are looked up here. That is
 * also what identifies a rung: `labelKey` is the React key and the equality
 * check for "the puck is in this one", neither of which survives comparing text
 * that changes with the language.
 */
export function RevealMeter({ heightPct, tiers, activeTier, bellLit }: Props) {
  const t = useT();

  return (
    <div className="flex h-72 w-full max-w-xs items-stretch gap-4" aria-hidden>
      {/* Tower */}
      <div className="relative w-20 shrink-0">
        {/* Bell at the summit — the ring-inset rim matches every other
            coin/token surface in the app (see IconButton). */}
        <div
          className={`absolute -top-1 left-1/2 z-10 grid h-11 w-11 -translate-x-1/2 -translate-y-full place-items-center rounded-full text-xl shadow-lg ring-2 ring-inset ring-ink/15 ${
            bellLit ? "bg-brand animate-flash" : "bg-white"
          }`}
        >
          <Icon name="bell" />
        </div>

        <div className="relative h-full overflow-hidden rounded-2xl bg-white/70 ring-1 ring-ink/10">
          {/* Fill */}
          <div
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-3 via-brand-2 to-brand"
            style={{ height: `${heightPct}%` }}
          />
          {/* Tick marks up the tower */}
          {tiers.map((tier) => (
            <div
              key={tier.labelKey}
              className="absolute inset-x-0 border-t border-dashed border-ink/15"
              style={{ bottom: `${tier.from * 100}%` }}
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
        {tiers.map((tier) => {
          const active = tier.labelKey === activeTier.labelKey;
          return (
            <div
              key={tier.labelKey}
              className="absolute inset-x-0 flex translate-y-1/2 items-center gap-2"
              style={{ bottom: `${tier.from * 100}%` }}
            >
              <span className={`h-px w-3 shrink-0 ${active ? "bg-brand" : "bg-ink/20"}`} />
              <Icon name={tier.iconKey} className="shrink-0 text-base" />
              {/* `truncate` on a Thai label cuts mid-word, since Thai has no
                  spaces — which is why the rung names in the dictionary are
                  kept short rather than translated phrase for phrase. */}
              <span
                className={`min-w-0 truncate text-sm ${
                  active ? "font-black text-ink" : "font-medium text-ink/40"
                }`}
              >
                {t(tier.labelKey)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
