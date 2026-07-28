import type { IconName } from "@minigames/icons";
import type { MiniGame } from "./types";
import { PrecisionStop } from "./PrecisionStop";
import { ReactionTimer } from "./ReactionTimer";
import { Stack } from "./Stack";
import { TapFast } from "./TapFast";

// The client-side registry mirrors the backend's game registry. To add a game:
//   1. build a <Play> component implementing PlayProps,
//   2. add a MiniGame entry here keyed by the same slug the backend uses.
// Everything else (session, submit, countdown, reward reveal, leaderboard) is
// shared, so nothing outside those two steps changes.
const games: MiniGame[] = [TapFast, ReactionTimer, PrecisionStop, Stack];

const bySlug = new Map(games.map((g) => [g.slug, g]));

/** Returns the play component registered for a slug, or undefined if the
 *  backend offers a game this client build does not yet know how to render. */
export function getMiniGame(slug: string): MiniGame | undefined {
  return bySlug.get(slug);
}

/** Icon shown for a backend game this build cannot render yet. */
const UNKNOWN_ICON: IconName = "game-controller";

/**
 * The icon to show for a slug.
 *
 * Falls back rather than throwing, because the picker deliberately lists games
 * this client cannot play (rendered disabled) so a version mismatch is visible
 * during a rollout instead of silently hiding content.
 */
export function gameIcon(slug: string): IconName {
  return bySlug.get(slug)?.icon ?? UNKNOWN_ICON;
}
