import type { ShowcasePrize } from "@minigames/player-core";
import { useT } from "../i18n";
import { Panel, PrizeImage } from "../ui";

/**
 * "Today's prizes" — what a customer can win, shown BEFORE they pick a game.
 *
 * This is the landing screen's only piece of motivation. Without it the app
 * opens on a list of games with no stated reason to play one, while the prizes
 * an admin carefully configured stay invisible until after a round is over.
 *
 * Purely presentational: the screen owns the fetch (see state/usePrizes), and
 * renders nothing at all when there is nothing on offer, so an unconfigured
 * store gets a clean picker rather than an empty box.
 */
export function PrizeShowcase({ prizes }: { prizes: ShowcasePrize[] }) {
  const t = useT();

  if (prizes.length === 0) return null;

  return (
    // The prize NAMES stay in whatever language the operator typed them: they
    // are admin free text, and translating them is a schema change rather than
    // a lookup (see docs/potential-features.md). Only the chrome around them
    // follows the player's language.
    <Panel title={t("home.prizes.title")} tone="muted">
      <ul className="flex flex-col gap-2">
        {prizes.map((p) => (
          <li key={p.name} className={`flex items-center gap-3 ${p.soldOut ? "opacity-50" : ""}`}>
            {/* The admin-set image when there is one, a gift otherwise — the
                same primitive the result screen uses, so a prize looks like
                itself on both sides of a round. */}
            <PrizeImage src={p.imageUrl} fallback="gift" />

            {/* min-w-0 so a long prize name truncates instead of pushing the
                sold-out badge off a 320px screen. */}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-ink">{p.name}</span>
              {p.description && (
                <span className="line-clamp-1 block text-xs text-ink/60">{p.description}</span>
              )}
            </span>

            {p.soldOut && (
              <span className="shrink-0 whitespace-nowrap rounded-full bg-ink/10 px-2 py-1 text-[11px] font-bold text-ink/60">
                {t("home.prizes.soldOut")}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
