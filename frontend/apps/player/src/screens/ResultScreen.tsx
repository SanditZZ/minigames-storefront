import { useCallback, useEffect, useState } from "react";
import type { Game, ScoreEntry, SubmitResult } from "@minigames/api-client";
import { api } from "../api";
import { Leaderboard } from "../components/Leaderboard";
import { ResultSummary } from "../components/ResultSummary";
import { ScoreReveal } from "../components/ScoreReveal";
import { bestScore, isNewRecord } from "../reveal/calc";
import { takeResult } from "../state/resultCache";
import { Spinner, Stack, StatusMessage } from "../ui";

interface Props {
  game: Game | null;
  loading: boolean;
  scoreId: string;
  /** True on the first arrival from a round: play the reveal animation. */
  reveal: boolean;
  onRevealed: () => void;
  onPlayAgain: () => void;
  onPickAnother: () => void;
}

/**
 * Route: "/result/:slug/:scoreId" — a finished round.
 *
 * The round is addressed by id rather than held in memory, so this screen works
 * identically whether the player just finished playing, refreshed the page, or
 * opened a link someone sent them. The reveal animation is the only difference,
 * and it is driven by the ?reveal flag rather than by how they got here.
 */
export function ResultScreen({
  game,
  loading,
  scoreId,
  reveal,
  onRevealed,
  onPlayAgain,
  onPickAnother,
}: Props) {
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [scores, setScores] = useState<ScoreEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [revealed, setRevealed] = useState(!reveal);

  const slug = game?.slug;

  // The result itself: taken from the hand-off cache when we just played it,
  // fetched from the API on a reload or a shared link.
  useEffect(() => {
    if (!slug) return;
    let alive = true;

    const cached = takeResult(scoreId);
    if (cached) {
      setResult(cached);
      return;
    }

    setResult(null);
    setFailed(false);
    api
      .scoreResult(slug, scoreId)
      .then((r) => alive && setResult(r))
      .catch(() => alive && setFailed(true));

    return () => {
      alive = false;
    };
  }, [slug, scoreId]);

  // The leaderboard, which doubles as the scale for the reveal meter.
  useEffect(() => {
    if (!slug) return;
    let alive = true;
    api
      .highScores(slug, 10)
      .then((r) => alive && setScores(r.scores ?? []))
      .catch(() => alive && setScores([]));
    return () => {
      alive = false;
    };
  }, [slug]);

  const finishReveal = useCallback(() => {
    setRevealed(true);
    onRevealed();
  }, [onRevealed]);

  if (loading) return <Spinner label="Loading…" />;

  if (!game || failed) {
    return (
      <StatusMessage
        icon="🔍"
        title="Result not found"
        detail="This score link may have expired or been mistyped."
        action={{ label: "Play a game", onClick: onPickAnother }}
      />
    );
  }

  // Wait for the leaderboard too: the meter is scaled against the house best,
  // so revealing before it lands would draw the tower against the wrong scale.
  if (!result || scores === null) return <Spinner label="Loading your score…" />;

  if (!revealed) {
    return (
      <ScoreReveal
        value={result.score.value}
        unit={game.scoreUnit}
        direction={game.direction}
        best={bestScore(scores)}
        isRecord={isNewRecord(result.rank)}
        onDone={finishReveal}
      />
    );
  }

  return (
    <Stack gap="lg" className="flex-1 items-center">
      <ResultSummary
        game={game}
        result={result}
        onPlayAgain={onPlayAgain}
        onPickAnother={onPickAnother}
      />
      <Leaderboard scores={scores} unit={game.scoreUnit} highlightId={result.score.id} />
    </Stack>
  );
}
