import type { MiniGame } from "./types";
import { TapFast } from "./TapFast";

// The client-side registry mirrors the backend's game registry. To add a game:
//   1. build a <Play> component implementing PlayProps,
//   2. add a MiniGame entry here keyed by the same slug the backend uses.
// Everything else (session, submit, reward reveal, leaderboard) is shared.
const games: MiniGame[] = [TapFast];

const bySlug = new Map(games.map((g) => [g.slug, g]));

/** Returns the play component registered for a slug, or undefined if the
 *  backend offers a game this client build does not yet know how to render. */
export function getMiniGame(slug: string): MiniGame | undefined {
  return bySlug.get(slug);
}
