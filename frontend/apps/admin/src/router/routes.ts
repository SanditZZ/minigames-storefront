// DATA layer: the shapes the admin app's URL can take. No logic, no imports
// from the calculation or action layers.
//
// Every panel is addressable, so an admin can bookmark the one they live in,
// send a colleague a link straight to it, and use Back/Forward instead of
// re-clicking tabs after every reload:
//
//   /                       → awards (the default panel)
//   /awards                 → prize configuration
//   /settings               → tunable knobs
//   /scores                 → leaderboard viewer
//   /scores?game=tap-fast   → …already filtered to one game
//
// The selected game rides in the query string rather than the path because it
// is a filter on a panel, not a different page: changing it should not add a
// history entry, and it is meaningless on the other two tabs.

/** The panels the admin shell can show. Also the path segment for each. */
export type Tab = "awards" | "settings" | "scores";

/** Tabs in display order, with their labels. The single source for both the
 *  tab strip and the set of paths the router recognises. */
export const TABS: { id: Tab; label: string }[] = [
  { id: "awards", label: "Awards" },
  { id: "settings", label: "Settings" },
  { id: "scores", label: "Scores" },
];

/** Shown when the URL names no panel (or an unknown one). */
export const DEFAULT_TAB: Tab = "awards";

/** Query-string key for the game filter on the scores panel. */
export const GAME_PARAM = "game";

/** A tab plus the query state that rides with it. */
export interface Location {
  tab: Tab;
  /** Game slug from ?game=; empty string when unset. */
  gameSlug: string;
}
