import { useCallback, useEffect, useState } from "react";
import type { Game, SubmitResult } from "@minigames/api-client";
import { api } from "./api";
import { useRouter } from "./router";
import { HomeScreen } from "./screens/HomeScreen";
import { PlayScreen } from "./screens/PlayScreen";
import { ResultScreen } from "./screens/ResultScreen";
import { stashResult } from "./state/resultCache";
import { Screen, StatusMessage } from "./ui";

/**
 * App maps the URL onto a screen and owns the one piece of state every screen
 * needs — the game catalog.
 *
 * There is no phase state machine here any more: the address bar IS the state.
 * That makes Back and Forward work for free, lets a finished round be reloaded
 * or shared, and keeps each screen ignorant of how the player reached it.
 */
export function App() {
  const router = useRouter();
  const [games, setGames] = useState<Game[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoadError("");
    api
      .listGames()
      .then((g) => alive && setGames(g))
      .catch(() => alive && setLoadError("Is the backend running?"));
    return () => {
      alive = false;
    };
  }, [reloadToken]);

  const gameFor = useCallback(
    (slug: string) => games?.find((g) => g.slug === slug) ?? null,
    [games],
  );

  // A finished round becomes a URL. `replace` rather than `push` so pressing
  // Back from the result goes to the picker instead of restarting the round the
  // player has just finished.
  const showResult = useCallback(
    (result: SubmitResult) => {
      stashResult(result);
      router.replace(
        { name: "result", slug: result.score.gameSlug, scoreId: result.score.id },
        { reveal: true },
      );
    },
    [router],
  );

  const goHome = useCallback(() => router.navigate({ name: "home" }), [router]);

  const { route } = router;

  return (
    <Screen>
      {route.name === "home" && (
        <HomeScreen
          games={games}
          error={loadError}
          playerName={router.playerName}
          onNameChange={router.setPlayerName}
          onPick={(game) => router.navigate({ name: "play", slug: game.slug })}
          onRetry={() => setReloadToken((n) => n + 1)}
        />
      )}

      {route.name === "play" && (
        <PlayScreen
          game={gameFor(route.slug)}
          loading={games === null && !loadError}
          playerName={router.playerName}
          onComplete={showResult}
          onCancel={goHome}
        />
      )}

      {route.name === "result" && (
        <ResultScreen
          game={gameFor(route.slug)}
          loading={games === null && !loadError}
          scoreId={route.scoreId}
          reveal={router.reveal}
          onRevealed={router.clearReveal}
          onPlayAgain={() => router.navigate({ name: "play", slug: route.slug })}
          onPickAnother={goHome}
        />
      )}

      {route.name === "notFound" && (
        <StatusMessage
          icon="🧭"
          title="Page not found"
          detail="That link doesn’t go anywhere."
          action={{ label: "Play a game", onClick: goHome }}
        />
      )}
    </Screen>
  );
}
