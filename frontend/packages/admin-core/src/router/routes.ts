// DATA layer: the shapes the admin app's URL can take. No logic, no imports
// from the calculation or action layers.
//
// Every panel and every filter is addressable, so an admin can bookmark the
// view they live in, send a colleague a link to exactly what they are looking
// at, and use Back/Forward instead of re-clicking tabs and re-picking filters
// after every reload:
//
//   /                                   → awards (the default panel)
//   /awards                             → prize configuration
//   /awards?game=tap-fast&status=active → …filtered
//   /awards?q=coffee&sort=stock         → …searched and re-sorted
//   /awards/new                         → create a prize
//   /awards/V1StGXR8_Z5                 → edit one prize, linkable
//   /settings                           → tunable knobs
//   /scores?game=tap-fast               → leaderboard for one game
//
// An award being edited lives in the PATH, not in component state, so a
// half-finished edit survives a reload and an admin can send a colleague a link
// to the exact prize under discussion. Filters stay in the query string even on
// a detail page, so leaving the form returns to the list the admin came from
// rather than dumping them back at an unfiltered view.
//
// ?game= is deliberately SHARED between the awards and scores panels. An admin
// investigating one game moves between its prizes and its leaderboard, and
// having the filter follow them is the whole point; a per-panel copy would mean
// re-picking the same game on arrival.

/** The panels the admin shell can show. Also the path segment for each. */
export type Tab = "awards" | "claims" | "settings" | "scores";

/** Tabs in display order, with their labels. The single source for both the
 *  tab strip and the set of paths the router recognises. */
export const TABS: { id: Tab; label: string }[] = [
  { id: "awards", label: "Awards" },
  { id: "claims", label: "Claims" },
  { id: "settings", label: "Settings" },
  { id: "scores", label: "Scores" },
];

/** Shown when the URL names no panel (or an unknown one). */
export const DEFAULT_TAB: Tab = "awards";

/** Panels that understand the shared ?game= filter. */
export const GAME_FILTER_TABS: Tab[] = ["awards", "scores"];

/** Active/inactive filter. "all" is the default and is never written to the URL. */
export type StatusFilter = "all" | "active" | "inactive";

/** Stock filter. "all" is the default and is never written to the URL. */
export type StockFilter = "all" | "in" | "out" | "unlimited";

/**
 * Claim status filter. "all" is the default and is never written to the URL.
 *
 * These values are the backend's own `?status=` vocabulary, passed straight
 * through to GET /api/v1/admin/claims rather than translated. The status is
 * derived from the SERVER's clock, so the filtering has to happen there; this
 * type exists to make the URL and the API speak the same words.
 *
 * It shares the ?status= key with StatusFilter above, which belongs to the
 * awards list. That is safe because the two never appear on the same tab and
 * each parser rejects the other's vocabulary — /claims?status=active and
 * /awards?status=issued both degrade to "all" rather than to a filter no
 * dropdown can represent.
 */
export type ClaimStatusFilter = "all" | "issued" | "redeemed" | "expired";

/** List ordering. "order" is the admin-configured sortOrder — the default. */
export type SortOrder = "order" | "name" | "threshold" | "stock";

export const STATUS_VALUES: StatusFilter[] = ["all", "active", "inactive"];
export const CLAIM_STATUS_VALUES: ClaimStatusFilter[] = ["all", "issued", "redeemed", "expired"];
export const STOCK_VALUES: StockFilter[] = ["all", "in", "out", "unlimited"];
export const SORT_VALUES: SortOrder[] = ["order", "name", "threshold", "stock"];

/** Query-string keys. Kept here so no module spells one as a loose string. */
export const GAME_PARAM = "game";
export const STATUS_PARAM = "status";
export const STOCK_PARAM = "stock";
export const QUERY_PARAM = "q";
export const SORT_PARAM = "sort";

/** Longest name search accepted from the URL. */
export const MAX_QUERY_LENGTH = 60;

/**
 * Path segment meaning "create a new award".
 *
 * Unambiguous against a real id by construction: ids are 11-character nanoids
 * (see the backend's internal/id), so a three-letter segment can never collide
 * with one.
 */
export const NEW_AWARD = "new";

/** A tab plus all the path and query state that rides with it. */
export interface Location {
  tab: Tab;
  /**
   * The award addressed by the path: "" for the list, NEW_AWARD for the create
   * form, otherwise the id of the award being edited.
   */
  awardId: string;
  /** Game slug from ?game=; "" means every game. */
  gameSlug: string;
  status: StatusFilter;
  stock: StockFilter;
  /** Claim status from ?status= on the claims tab. Separate field from
   *  `status` because the two tabs read the same key with different
   *  vocabularies — see ClaimStatusFilter. */
  claimStatus: ClaimStatusFilter;
  /** Name search from ?q=; "" when unset. */
  query: string;
  sort: SortOrder;
}

/** The location an unfiltered default panel corresponds to. */
export const DEFAULT_LOCATION: Location = {
  tab: DEFAULT_TAB,
  awardId: "",
  gameSlug: "",
  status: "all",
  stock: "all",
  claimStatus: "all",
  query: "",
  sort: "order",
};
