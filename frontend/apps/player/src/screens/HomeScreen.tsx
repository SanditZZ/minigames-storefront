import type { Game } from "@minigames/api-client";
import { GamePicker } from "../components/GamePicker";
import { Spinner, StatusMessage } from "../ui";

interface Props {
  games: Game[] | null;
  error: string;
  playerName: string;
  onNameChange: (name: string) => void;
  onPick: (game: Game) => void;
  onRetry: () => void;
}

/** Route: "/" — choose a game. */
export function HomeScreen({ games, error, playerName, onNameChange, onPick, onRetry }: Props) {
  if (error) {
    return (
      <StatusMessage
        icon="📡"
        title="Can’t reach the games"
        detail={error}
        action={{ label: "Try again", onClick: onRetry }}
      />
    );
  }
  if (games === null) return <Spinner label="Loading games…" />;

  return <GamePicker games={games} playerName={playerName} onNameChange={onNameChange} onPick={onPick} />;
}
