import type { Game } from "@minigames/api-client";
import { MAX_NAME_LENGTH, type ShowcasePrize } from "@minigames/player-core";
import { gameIcon, getMiniGame } from "../games/registry";
import { useT, type Locale } from "../i18n";
import { useStoreIdentity } from "../state/StoreProvider";
import { Icon, IconButton, PageHeader, SelectCard, Stack, TextField } from "../ui";
import { LanguageToggle } from "./LanguageToggle";
import { PrizeShowcase } from "./PrizeShowcase";

interface Props {
  games: Game[];
  prizes: ShowcasePrize[];
  playerName: string;
  onNameChange: (name: string) => void;
  onLangChange: (locale: Locale) => void;
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
  prizes,
  playerName,
  onNameChange,
  onLangChange,
  onPick,
  onRefresh,
  refreshing,
}: Props) {
  const t = useT();
  // Read rather than received: the store's identity is ambient app state, the
  // same as the translator beside it. `refreshing` stays a prop because the
  // reload it reports is the CATALOG's as well — one gesture, owned by App.
  const identity = useStoreIdentity();

  return (
    <Stack gap="lg" className="flex-1">
      {/* Above the hero rather than beside it: PageHeader's action slot is
          width-mirrored by a fixed spacer so the headline stays optically
          centred, and a second control in there would push the title off
          centre on a 320px screen. A player also chooses a language BEFORE
          reading anything, so first is where it belongs. */}
      <div className="flex justify-end">
        <LanguageToggle onChange={onLangChange} />
      </div>

      <PageHeader
        brand={identity.name}
        logoUrl={identity.logoUrl}
        title={
          <span className="inline-flex items-center gap-2">
            {t("home.title")}
            <Icon name="gift" />
          </span>
        }
        subtitle={identity.tagline}
        // The store's identity, prizes and games are all admin-editable while
        // this screen sits open on a till-side phone that nobody reloads. This
        // is that phone's reload button.
        action={
          <IconButton
            variant="quiet"
            label={refreshing ? t("home.refreshing") : t("home.refresh")}
            disabled={refreshing}
            onClick={onRefresh}
          >
            <Icon name="arrow-clockwise" className={refreshing ? "animate-spin" : undefined} />
          </IconButton>
        }
      />

      {/* Prizes sit above the games: a customer decides whether to play at all
          before they decide what to play, and the answer to "why bother?" is
          the prize list. */}
      <PrizeShowcase prizes={prizes} />

      <TextField
        label={t("home.nameLabel")}
        value={playerName}
        onChange={(e) => onNameChange(e.target.value)}
        maxLength={MAX_NAME_LENGTH}
        // The same string the round submits when this is left empty, so the
        // placeholder is a promise the leaderboard keeps.
        placeholder={t("player.guest")}
        autoComplete="given-name"
      />

      <Stack>
        {games.map((game) => (
          <SelectCard
            key={game.slug}
            // Each game carries its own icon, so two cards are told apart at a
            // glance instead of sharing one generic gamepad.
            media={<Icon name={gameIcon(game.slug)} />}
            title={game.name}
            subtitle={game.description}
            action={getMiniGame(game.slug) ? t("home.play") : t("home.soon")}
            disabled={!getMiniGame(game.slug)}
            onClick={() => onPick(game)}
          />
        ))}
      </Stack>
    </Stack>
  );
}
