import type { Game } from "@minigames/api-client";
import { BRAND_NAME, BRAND_TAGLINE } from "../brand";
import { gameIcon, getMiniGame } from "../games/registry";
import type { ShowcasePrize } from "../prizes/merge";
import { MAX_NAME_LENGTH } from "../router";
import { PageHeader, SelectCard, Stack, TextField } from "../ui";
import { PrizeShowcase } from "./PrizeShowcase";

interface Props {
  games: Game[];
  prizes: ShowcasePrize[];
  playerName: string;
  onNameChange: (name: string) => void;
  onPick: (game: Game) => void;
}

/**
 * Landing screen: capture an optional display name and list playable games.
 * A backend game this client build can't render is shown disabled (not hidden),
 * so a version mismatch is visible during rollout.
 *
 * Composed entirely from the UI kit — this file contains no styling of its own.
 */
export function GamePicker({ games, prizes, playerName, onNameChange, onPick }: Props) {
  return (
    <Stack gap="lg" className="flex-1">
      <PageHeader brand={BRAND_NAME} title="Play & Win 🎁" subtitle={BRAND_TAGLINE} />

      {/* Prizes sit above the games: a customer decides whether to play at all
          before they decide what to play, and the answer to "why bother?" is
          the prize list. */}
      <PrizeShowcase prizes={prizes} />

      <TextField
        label="Your name (optional)"
        value={playerName}
        onChange={(e) => onNameChange(e.target.value)}
        maxLength={MAX_NAME_LENGTH}
        placeholder="Guest"
        autoComplete="given-name"
      />

      <Stack>
        {games.map((game) => (
          <SelectCard
            key={game.slug}
            // Each game carries its own icon, so two cards are told apart at a
            // glance instead of sharing one generic controller emoji.
            media={gameIcon(game.slug)}
            title={game.name}
            subtitle={game.description}
            action={getMiniGame(game.slug) ? "Play" : "Soon"}
            disabled={!getMiniGame(game.slug)}
            onClick={() => onPick(game)}
          />
        ))}
      </Stack>
    </Stack>
  );
}
