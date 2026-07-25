import { useCallback, useEffect, useRef, useState } from "react";
import type { Game, SubmitResult } from "@minigames/api-client";
import { ApiError } from "@minigames/api-client";
import { api } from "../api";
import { getMiniGame } from "../games/registry";
import { GameStage, Spinner, StatusMessage } from "../ui";
import { GameCompleteStage } from "./GameCompleteStage";

interface Props {
  game: Game;
  playerName: string;
  onComplete: (result: SubmitResult) => void;
  onCancel: () => void;
}

type Phase = "loading" | "ready" | "complete" | "error";

/**
 * RoundRunner owns the shared play plumbing for ANY game: it requests a
 * server session, hands the game its round duration, submits the reported
 * score, and runs the celebration beat before handing the result upward. The
 * specific game is looked up from the client registry by slug and rendered
 * inside the shared GameStage, so this file never changes when games are added
 * and every game inherits the same chrome and the same ending.
 */
export function RoundRunner({ game, playerName, onComplete, onCancel }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [wantsContinue, setWantsContinue] = useState(false);
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

  // The round ends → celebrate immediately and upload in the background, so the
  // network round-trip happens behind the confetti instead of behind a spinner.
  const handleFinish = useCallback(
    (value: number) => {
      setPhase("complete");
      api
        .submitScore(game.slug, { token: tokenRef.current, playerName, value })
        .then(setResult)
        .catch((e) => {
          setError(e instanceof ApiError ? e.message : "Could not submit your score.");
          setPhase("error");
        });
    },
    [game.slug, playerName],
  );

  // Hand over as soon as BOTH the player has tapped continue and the score has
  // landed — whichever happens second.
  useEffect(() => {
    if (result && wantsContinue) onComplete(result);
  }, [result, wantsContinue, onComplete]);

  if (!mini) {
    return (
      <StatusMessage
        icon="🧩"
        title="Not available yet"
        detail="This game isn’t in this app version yet."
        action={{ label: "Back", onClick: onCancel }}
      />
    );
  }

  if (phase === "error") {
    return <StatusMessage icon="😕" title="Something went wrong" detail={error} action={{ label: "Back", onClick: onCancel }} />;
  }

  if (phase === "loading") {
    return <Spinner label="Getting ready…" />;
  }

  if (phase === "complete") {
    return <GameCompleteStage pending={result === null} onContinue={() => setWantsContinue(true)} />;
  }

  const Play = mini.Play;
  return (
    <GameStage title={game.name} subtitle={`Playing as ${playerName}`} onQuit={onCancel}>
      <Play durationMs={durationRef.current} onFinish={handleFinish} />
    </GameStage>
  );
}
