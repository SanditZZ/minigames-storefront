import type { Game } from "@minigames/api-client";
import { GamePicker } from "../components/GamePicker";
import { useT, type Locale } from "../i18n";
import { usePrizes } from "../state/usePrizes";
import { Spinner, StatusMessage } from "../ui";

interface Props {
  games: Game[] | null;
  error: string;
  playerName: string;
  onNameChange: (name: string) => void;
  onLangChange: (locale: Locale) => void;
  onPick: (game: Game) => void;
  onRetry: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}

/** Route: "/" — choose a game. */
export function HomeScreen({
  games,
  error,
  playerName,
  onNameChange,
  onLangChange,
  onPick,
  onRetry,
  onRefresh,
  refreshing,
}: Props) {
  const t = useT();
  // Loaded here rather than in App: prizes are this screen's concern only, and
  // the hook tolerates a null catalog so it can be called before the early
  // returns below (hooks cannot live behind a condition).
  const prizes = usePrizes(games);

  if (error) {
    return (
      <StatusMessage
        tone="error"
        icon="wifi-slash"
        title={t("home.unreachable.title")}
        detail={error}
        action={{ label: t("home.unreachable.action"), onClick: onRetry }}
      />
    );
  }
  if (games === null) return <Spinner label={t("home.loading")} />;

  return (
    <GamePicker
      games={games}
      prizes={prizes}
      playerName={playerName}
      onNameChange={onNameChange}
      onLangChange={onLangChange}
      onPick={onPick}
      onRefresh={onRefresh}
      refreshing={refreshing}
    />
  );
}
