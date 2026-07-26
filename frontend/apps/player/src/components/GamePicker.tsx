import type { Game } from "@minigames/api-client";
import { MAX_NAME_LENGTH, type ShowcasePrize, type StoreIdentity } from "@minigames/player-core";
import { gameIcon, getMiniGame } from "../games/registry";
import { IconButton, PageHeader, SelectCard, Stack, TextField } from "../ui";
import { PrizeShowcase } from "./PrizeShowcase";

interface Props {
  games: Game[];
  /** Store name and tagline, already resolved against their fallbacks. */
  identity: StoreIdentity;
  prizes: ShowcasePrize[];
  playerName: string;
  onNameChange: (name: string) => void;
  onPick: (game: Game) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

/**
 * Landing screen: capture an optional display name and list playable games.
 * A backend game this client build can't render is shown disabled (not hidden),
 * so a version mismatch is visible during rollout.
 *
 * Composed entirely from the UI kit — this file contains no styling of its own.
 */
export function GamePicker({
  games,
  identity,
  prizes,
  playerName,
  onNameChange,
  onPick,
  onRefresh,
  refreshing,
}: Props) {
  return (
    <Stack gap="lg" className="flex-1">
      <PageHeader
        brand={identity.name}
        title="Play & Win 🎁"
        subtitle={identity.tagline}
        // The store's identity, prizes and games are all admin-editable while
        // this screen sits open on a till-side phone that nobody reloads. This
        // is that phone's reload button.
        action={
          <IconButton
            variant="quiet"
            label={refreshing ? "Refreshing…" : "Refresh store details"}
            disabled={refreshing}
            onClick={onRefresh}
          >
            <span aria-hidden className={refreshing ? "inline-block animate-spin" : undefined}>
              ↻
            </span>
          </IconButton>
        }
      />

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
