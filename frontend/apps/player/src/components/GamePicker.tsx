import type { Game } from "@minigames/api-client";
import { BRAND_NAME, BRAND_TAGLINE } from "../brand";
import { getMiniGame } from "../games/registry";
import { MAX_NAME_LENGTH } from "../router";
import { PageHeader, SelectCard, Stack, TextField } from "../ui";

interface Props {
  games: Game[];
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
export function GamePicker({ games, playerName, onNameChange, onPick }: Props) {
  return (
    <Stack gap="lg" className="flex-1">
      <PageHeader brand={BRAND_NAME} title="Play & Win 🎁" subtitle={BRAND_TAGLINE} />

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
            media="🎮"
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
