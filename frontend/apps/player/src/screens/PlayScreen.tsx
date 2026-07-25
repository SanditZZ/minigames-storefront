import type { Game, SubmitResult } from "@minigames/api-client";
import { RoundRunner } from "../components/RoundRunner";
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
  if (loading) return <Spinner label="Getting ready…" />;

  if (!game) {
    return (
      <StatusMessage
        icon="🔍"
        title="Game not found"
        detail="That game isn’t available right now."
        action={{ label: "See all games", onClick: onCancel }}
      />
    );
  }

  return (
    <RoundRunner
      game={game}
      playerName={playerName.trim() || "Guest"}
      onComplete={onComplete}
      onCancel={onCancel}
    />
  );
}
