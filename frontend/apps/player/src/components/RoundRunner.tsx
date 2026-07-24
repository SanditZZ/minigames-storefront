import { useCallback, useEffect, useRef, useState } from "react";
import type { Game, SubmitResult } from "@minigames/api-client";
import { ApiError } from "@minigames/api-client";
import { api } from "../api";
import { getMiniGame } from "../games/registry";
import { Button, CenterStack, GameStage, Spinner } from "../ui";

interface Props {
  game: Game;
  playerName: string;
  onComplete: (result: SubmitResult) => void;
  onCancel: () => void;
}

type Phase = "loading" | "ready" | "submitting" | "error";

/**
 * RoundRunner owns the shared play plumbing for ANY game: it requests a
 * server session, hands the game its round duration, then submits the reported
 * score. The specific game is looked up from the client registry by slug and
 * rendered inside the shared GameStage, so this file never changes when games
 * are added and every game inherits the same chrome.
 */
export function RoundRunner({ game, playerName, onComplete, onCancel }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const tokenRef = useRef("");
  const durationRef = useRef(game.durationMs);
  const mini = getMiniGame(game.slug);

  useEffect(() => {
    let alive = true;
    api
      .startSession(game.slug)
      .then((s) => {
        if (!alive) return;
        tokenRef.current = s.token;
        durationRef.current = s.durationMs;
        setPhase("ready");
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof ApiError ? e.message : "Could not start the game.");
        setPhase("error");
      });
    return () => {
      alive = false;
    };
  }, [game.slug]);

  const handleFinish = useCallback(
    (value: number) => {
      setPhase("submitting");
      api
        .submitScore(game.slug, { token: tokenRef.current, playerName, value })
        .then(onComplete)
        .catch((e) => {
          setError(e instanceof ApiError ? e.message : "Could not submit your score.");
          setPhase("error");
        });
    },
    [game.slug, playerName, onComplete],
  );

  if (!mini) {
    return (
      <CenterStack>
        <p className="text-center text-white/90">This game isn’t available in this app version yet.</p>
        <Button onClick={onCancel}>Back</Button>
      </CenterStack>
    );
  }

  if (phase === "error") {
    return (
      <CenterStack>
        <p className="max-w-sm text-center text-white/90">{error}</p>
        <Button onClick={onCancel}>Back</Button>
      </CenterStack>
    );
  }

  if (phase === "loading" || phase === "submitting") {
    return <Spinner label={phase === "loading" ? "Getting ready…" : "Scoring…"} />;
  }

  const Play = mini.Play;
  return (
    <GameStage title={game.name} onQuit={onCancel}>
      <Play durationMs={durationRef.current} onFinish={handleFinish} />
    </GameStage>
  );
}
