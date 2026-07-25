// DATA layer: the route shapes this app can be in. No logic, no imports from
// calculations or actions.
//
// Every screen the player can reach has its own URL, so the browser's back and
// forward buttons move through the flow the way a player expects:
//
//   /                                    → pick a game
//   /play/tap-fast                       → play a round
//   /result/tap-fast/{scoreId}           → the finished round (permanent, shareable)
//   /result/tap-fast/{scoreId}?reveal=1  → …the first time, with the score-reveal animation
//
// Two pieces of state ride in the query string rather than in React state:
//   ?name=   the display name, so it survives navigation and can be pre-filled
//            by a kiosk link.
//   ?reveal= set once when arriving fresh from a round. The result screen drops
//            it from the URL as soon as the animation finishes, so a reload or a
//            shared link shows the score immediately instead of replaying the
//            build-up to someone who already knows the number.

/** The parsed, validated location the app renders. */
export type Route =
  | { name: "home" }
  | { name: "play"; slug: string }
  | { name: "result"; slug: string; scoreId: string }
  | { name: "notFound"; path: string };

/** A route plus the query state that rides along with it. */
export interface Location {
  route: Route;
  /** Display name from ?name=; empty string when unset. */
  playerName: string;
  /** True when the score-reveal animation should play on arrival. */
  reveal: boolean;
}

/** Query-string key for the player's display name. */
export const NAME_PARAM = "name";

/** Query-string key for the one-shot score-reveal animation. */
export const REVEAL_PARAM = "reveal";

/** Longest display name accepted from the URL, matching the backend's limit. */
export const MAX_NAME_LENGTH = 40;
