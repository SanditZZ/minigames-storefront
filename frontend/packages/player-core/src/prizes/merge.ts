// CALCULATIONS layer: turning per-game prize lists into the one strip the
// landing screen advertises. Pure functions only — no fetching, no React.

import type { Prize } from "@minigames/api-client";

/** A prize as advertised on the landing screen, across all games. */
export interface ShowcasePrize {
  name: string;
  description: string;
  imageUrl: string;
  /** True only when the prize is unavailable in EVERY game that offers it. */
  soldOut: boolean;
}

/**
 * Merges the prize lists of every game into one showcase, de-duplicated by name.
 *
 * The landing screen is answering "what can I win here?", not "what does each
 * game pay out?" — the player has not chosen a game yet. So thresholds are
 * dropped (they are meaningless without a game, and differ per game: 40 taps
 * versus 300ms both buy the same coffee) and the same prize offered by two
 * games appears once.
 *
 * A prize counts as sold out only when it has run out everywhere. If any game
 * can still award it, it is still winnable, and greying it out would talk a
 * customer out of a prize they could have had.
 */
export function mergePrizes(lists: Prize[][]): ShowcasePrize[] {
  const byName = new Map<string, ShowcasePrize>();

  for (const list of lists) {
    for (const p of list) {
      const existing = byName.get(p.name);
      if (!existing) {
        byName.set(p.name, {
          name: p.name,
          description: p.description,
          imageUrl: p.imageUrl,
          soldOut: p.soldOut,
        });
        continue;
      }
      // Available anywhere wins; keep the first non-empty copy of the blurb.
      existing.soldOut = existing.soldOut && p.soldOut;
      if (!existing.description) existing.description = p.description;
      if (!existing.imageUrl) existing.imageUrl = p.imageUrl;
    }
  }

  return [...byName.values()];
}

/**
 * Orders the showcase for display: winnable prizes first, then sold-out ones.
 *
 * Within each group the incoming order is preserved, which is the backend's
 * easiest-first ordering — so the first thing a customer reads is the prize
 * they are most likely to actually walk away with.
 */
export function orderPrizes(prizes: ShowcasePrize[]): ShowcasePrize[] {
  return [...prizes.filter((p) => !p.soldOut), ...prizes.filter((p) => p.soldOut)];
}
