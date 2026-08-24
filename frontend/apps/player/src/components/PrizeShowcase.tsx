import type { ShowcasePrize } from "@minigames/player-core";
import { useT } from "../i18n";
import { Card, Eyebrow, PrizeImage } from "../ui";

/**
 * "Today's prizes" — what a customer can win, shown BEFORE they pick a game.
 *
 * This is the landing screen's only piece of motivation. Without it the app
 * opens on a list of games with no stated reason to play one, while the prizes
 * an admin carefully configured stay invisible until after a round is over.
 *
 * A horizontally-scrolling rack of prize tickets rather than a vertical list —
 * a shelf to browse, matching how the same prize is presented as a ticket on
 * the result screen (see ClaimCard). Purely presentational: the screen owns
 * the fetch (see state/usePrizes), and renders nothing at all when there is
 * nothing on offer, so an unconfigured store gets a clean picker rather than
 * an empty box.
 */
export function PrizeShowcase({ prizes }: { prizes: ShowcasePrize[] }) {
  const t = useT();

  if (prizes.length === 0) return null;

  return (
    <div>
      <Eyebrow className="mb-2">{t("home.prizes.title")}</Eyebrow>
      {/* The negative margin lets the rack run edge-to-edge with the screen,
          escaping Screen's own px-5 padding; `px-5` on the list restores that
          gap as scroll inset instead. `snap-x` settles on a whole ticket
          rather than leaving one half-visible. */}
      <ul className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1">
        {prizes.map((p) => (
          <li key={p.name} className={`w-36 shrink-0 snap-start ${p.soldOut ? "opacity-50" : ""}`}>
            {/* The prize NAME stays in whatever language the operator typed
                it: it's admin free text, and translating it is a schema
                change rather than a lookup (see docs/potential-features.md).
                Only the chrome around it follows the player's language. */}
            <Card shape="ticket" notch="sm" tone="muted" className="h-full text-center">
              {/* The admin-set image when there is one, a gift otherwise — the
                  same primitive the result screen uses, so a prize looks like
                  itself on both sides of a round. */}
              <PrizeImage src={p.imageUrl} fallback="gift" className="mx-auto" />
              <span className="mt-2 block truncate text-sm font-bold text-ink">{p.name}</span>
              {p.description && (
                <span className="line-clamp-2 block text-xs text-ink/60">{p.description}</span>
              )}
              {p.soldOut && (
                <span className="mt-1 inline-block whitespace-nowrap rounded-full bg-ink/10 px-2 py-1 text-[11px] font-bold text-ink/60">
                  {t("home.prizes.soldOut")}
                </span>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
