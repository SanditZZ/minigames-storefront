import type { Game } from "@minigames/api-client";
import type { StoreIdentity } from "@minigames/player-core";
import { GamePicker } from "../components/GamePicker";
import { usePrizes } from "../state/usePrizes";
import { Spinner, StatusMessage } from "../ui";

interface Props {
  games: Game[] | null;
  identity: StoreIdentity;
  error: string;
  playerName: string;
  onNameChange: (name: string) => void;
  onPick: (game: Game) => void;
  onRetry: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}

/** Route: "/" — choose a game. */
export function HomeScreen({
  games,
  identity,
  error,
  playerName,
  onNameChange,
  onPick,
  onRetry,
  onRefresh,
  refreshing,
}: Props) {
  // Loaded here rather than in App: prizes are this screen's concern only, and
  // the hook tolerates a null catalog so it can be called before the early
  // returns below (hooks cannot live behind a condition).
  const prizes = usePrizes(games);

  if (error) {
    return (
      <StatusMessage
        tone="error"
        icon="📡"
        title="Can’t reach the games"
        detail={error}
        action={{ label: "Try again", onClick: onRetry }}
      />
    );
  }
  if (games === null) return <Spinner label="Loading games…" />;

  return (
    <GamePicker
      games={games}
      identity={identity}
      prizes={prizes}
      playerName={playerName}
      onNameChange={onNameChange}
      onPick={onPick}
      onRefresh={onRefresh}
      refreshing={refreshing}
    />
  );
}
