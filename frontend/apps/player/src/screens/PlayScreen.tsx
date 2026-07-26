import type { Game, SubmitResult } from "@minigames/api-client";
import { RoundRunner } from "../components/RoundRunner";
import { useT } from "../i18n";
import { Spinner, StatusMessage } from "../ui";

interface Props {
  game: Game | null;
  /** null while the catalog is still loading. */
  loading: boolean;
  playerName: string;
  onComplete: (result: SubmitResult) => void;
  onCancel: () => void;
}

/**
 * Route: "/play/:slug" — play one round.
 *
 * Reloading this URL legitimately starts a fresh round: a session token is
 * single-use and lives on the server, so there is nothing to restore.
 */
export function PlayScreen({ game, loading, playerName, onComplete, onCancel }: Props) {
  const t = useT();

  if (loading) return <Spinner label={t("play.loading")} />;

  if (!game) {
    return (
      <StatusMessage
        icon="🔍"
        title={t("play.notFound.title")}
        detail={t("play.notFound.detail")}
        action={{ label: t("play.notFound.action"), onClick: onCancel }}
      />
    );
  }

  return (
    <RoundRunner
      game={game}
      // The fallback name reads the same in every language on purpose. It is
      // written to the scores table and then read by everyone looking at that
      // leaderboard, so a round played in Thai must not appear under a name the
      // next player cannot read — see the note on "player.guest" in the
      // dictionary.
      playerName={playerName.trim() || t("player.guest")}
      onComplete={onComplete}
      onCancel={onCancel}
    />
  );
}
