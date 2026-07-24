import { useEffect, useState } from "react";
import type { Game, SubmitResult } from "@minigames/api-client";
import { api } from "./api";
import { GamePicker } from "./components/GamePicker";
import { RoundRunner } from "./components/RoundRunner";
import { RewardReveal } from "./components/RewardReveal";
import { Leaderboard } from "./components/Leaderboard";
import { Screen, Spinner } from "./ui";

type Phase = "picking" | "playing" | "result";

/**
 * App is the player-flow state machine: pick a game → play a server-timed round
 * → reveal the reward + leaderboard. It holds no game or scoring logic itself;
 * each screen delegates to the backend and the game registry.
 */
export function App() {
  const [games, setGames] = useState<Game[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [phase, setPhase] = useState<Phase>("picking");
  const [selected, setSelected] = useState<Game | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    api
      .listGames()
      .then(setGames)
      .catch(() => setLoadError("Couldn’t reach the game server. Is the backend running?"));
  }, []);

  return (
    <Screen>
      <>
        {phase === "picking" && (
          <>
            {loadError ? (
              <div className="flex flex-1 items-center justify-center text-center text-ink/80">
                {loadError}
              </div>
            ) : games === null ? (
              <Spinner label="Loading games…" />
            ) : (
              <GamePicker
                games={games}
                playerName={playerName}
                onNameChange={setPlayerName}
                onPick={(g) => {
                  setSelected(g);
                  setPhase("playing");
                }}
              />
            )}
          </>
        )}

        {phase === "playing" && selected && (
          <RoundRunner
            game={selected}
            playerName={playerName.trim() || "Guest"}
            onComplete={(r) => {
              setResult(r);
              setPhase("result");
            }}
            onCancel={() => setPhase("picking")}
          />
        )}

        {phase === "result" && selected && result && (
          <div className="flex flex-1 flex-col gap-6">
            <RewardReveal game={selected} result={result} onPlayAgain={() => setPhase("picking")} />
            <div className="flex justify-center">
              <Leaderboard game={selected} highlightId={result.score.id} />
            </div>
          </div>
        )}
      </>
    </Screen>
  );
}
