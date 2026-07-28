import { useCallback, useEffect, useRef, useState } from "react";
import type { Game, SubmitResult } from "@minigames/api-client";
import { ApiError } from "@minigames/api-client";
import { getMiniGame } from "../games/registry";
import type { RoundReport } from "../games/types";
import { useApi, useT } from "../i18n";
import { Countdown, GameStage, Spinner, StatusMessage } from "../ui";
import { GameCompleteStage } from "./GameCompleteStage";

interface Props {
  game: Game;
  playerName: string;
  onComplete: (result: SubmitResult) => void;
  onCancel: () => void;
}

type Phase = "loading" | "countdown" | "playing" | "complete" | "error";

/**
 * RoundRunner owns the shared play plumbing for ANY game: it requests a
 * server session, hands the game its round duration, submits the reported
 * score, and runs the celebration beat before handing the result upward. The
 * specific game is looked up from the client registry by slug and rendered
 * inside the shared GameStage, so this file never changes when games are added
 * and every game inherits the same chrome and the same ending.
 */
export function RoundRunner({ game, playerName, onComplete, onCancel }: Props) {
  const t = useT();
  // The API's own error messages are shown to the player verbatim below, so
  // they have to arrive in the player's language — which is what this client
  // asks for. See backend/internal/i18n.
  const api = useApi();
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [wantsContinue, setWantsContinue] = useState(false);
  const tokenRef = useRef("");
  const durationRef = useRef(game.durationMs);
  // Held in state rather than a ref because it is RENDERED — the game cannot
  // mount until the challenge that describes its round has arrived, and a ref
  // would not re-render when it does. The three client-scored games leave it
  // undefined and never look.
  const [challenge, setChallenge] = useState<unknown>(undefined);
  const mini = getMiniGame(game.slug);

  useEffect(() => {
    let alive = true;
    api
      .startSession(game.slug)
      .then((s) => {
        if (!alive) return;
        tokenRef.current = s.token;
        durationRef.current = s.durationMs;
        setChallenge(s.challenge);
        setPhase("countdown");
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof ApiError ? e.message : t("play.startFailed"));
        setPhase("error");
      });
    return () => {
      alive = false;
    };
  }, [api, t, game.slug]);

  // The countdown finishing is what starts the round. Games therefore mount
  // already-counted-in and can begin timing on their first frame, instead of
  // each inventing its own "tap to start" gate.
  const startPlaying = useCallback(() => setPhase("playing"), []);

  // The round ends → celebrate immediately and upload in the background, so the
  // network round-trip happens behind the confetti instead of behind a spinner.
  const handleFinish = useCallback(
    (report: RoundReport) => {
      setPhase("complete");
      // A game reports EITHER a score it worked out or the moments the player
      // acted; this is the one place that distinction turns into a request
      // shape, so no game has to know the wire. See RoundReport.
      const round = Array.isArray(report) ? { events: report } : { value: report };
      api
        .submitScore(game.slug, { token: tokenRef.current, playerName, ...round })
        .then(setResult)
        .catch((e) => {
          setError(e instanceof ApiError ? e.message : t("play.submitFailed"));
          setPhase("error");
        });
    },
    [api, t, game.slug, playerName],
  );

  // Hand over as soon as BOTH the player has tapped continue and the score has
  // landed — whichever happens second.
  useEffect(() => {
    if (result && wantsContinue) onComplete(result);
  }, [result, wantsContinue, onComplete]);

  if (!mini) {
    return (
      <StatusMessage
        icon="puzzle"
        title={t("play.unsupported.title")}
        detail={t("play.unsupported.detail")}
        action={{ label: t("play.back"), onClick: onCancel }}
      />
    );
  }

  if (phase === "error") {
    // tone="error" is the failed submit the roadmap called silent: the player
    // finished a round, the score did not land, and nothing said so out loud.
    return (
      <StatusMessage
        tone="error"
        icon="frown"
        title={t("play.failed.title")}
        detail={error}
        action={{ label: t("play.back"), onClick: onCancel }}
      />
    );
  }

  if (phase === "loading") {
    return <Spinner label={t("play.loading")} />;
  }

  if (phase === "complete") {
    return <GameCompleteStage pending={result === null} onContinue={() => setWantsContinue(true)} />;
  }

  const Play = mini.Play;
  return (
    // `confirmQuit` once the round is live: Quit sits a stray thumb away from a
    // rapid-tap target, and one mis-tap should not silently destroy a round in
    // progress. Before the round starts it still quits on the first press —
    // backing out before you begin costs nothing and needs no ceremony.
    <GameStage
      title={game.name}
      subtitle={t("play.playingAs", { name: playerName })}
      onQuit={onCancel}
      confirmQuit={phase === "playing"}
    >
      {phase === "countdown" ? (
        <Countdown label={game.name} onDone={startPlaying} />
      ) : (
        <Play
          durationMs={durationRef.current}
          scoreUnit={game.scoreUnit}
          challenge={challenge}
          onFinish={handleFinish}
        />
      )}
    </GameStage>
  );
}
