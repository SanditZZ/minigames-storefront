import { useCallback, useEffect, useState } from "react";
import type { Game, ScoreEntry, SubmitResult } from "@minigames/api-client";
import { Leaderboard } from "../components/Leaderboard";
import { ResultSummary } from "../components/ResultSummary";
import { ScoreReveal } from "../components/ScoreReveal";
import { useApi, useT } from "../i18n";
import { benchmarkFor, bestScore, isNewRecord } from "@minigames/player-core";
import { takeResult } from "../state/resultCache";
import { useStoreIdentity } from "../state/StoreProvider";
import { Spinner, Stack, StatusMessage, StoreMark } from "../ui";

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
  const t = useT();
  // Language-aware, like every other fetch in this app: the score unit printed
  // beside each leaderboard row arrives with the board.
  const api = useApi();
  const identity = useStoreIdentity();
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
  }, [api, slug, scoreId]);

  // The leaderboard. It is also the meter's FALLBACK scale, for a game whose
  // catalog entry declares no targetScore — see benchmarkFor.
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
  }, [api, slug]);

  const finishReveal = useCallback(() => {
    setRevealed(true);
    onRevealed();
  }, [onRevealed]);

  if (loading) return <Spinner label={t("result.loading")} />;

  if (!game || failed) {
    return (
      <StatusMessage
        icon="magnifying-glass"
        title={t("result.notFound.title")}
        detail={t("result.notFound.detail")}
        action={{ label: t("result.notFound.action"), onClick: onPickAnother }}
      />
    );
  }

  // Wait for the leaderboard too. The meter usually scales against the game's
  // own targetScore and would not need it — but the board is still the fallback
  // for a game without one, and revealing before it lands would draw the tower
  // against the wrong scale in exactly the case that has no other scale.
  if (!result || scores === null) return <Spinner label={t("result.loadingScore")} />;

  if (!revealed) {
    return (
      <ScoreReveal
        value={result.score.value}
        unit={game.scoreUnit}
        direction={game.direction}
        benchmark={benchmarkFor(game.targetScore, bestScore(scores))}
        isRecord={isNewRecord(result.rank)}
        onDone={finishReveal}
      />
    );
  }

  return (
    <Stack gap="lg" className="flex-1 items-center">
      {/* The store, small, above its own result. This URL is the one thing a
          player shares, and until now it was the only screen that could arrive
          in a stranger's hands without saying whose storefront it came from.
          Deliberately a credit and not a hero: the score is the subject here,
          so this is `sm` and the landing screen keeps the full PageHeader.
          The reveal is left untouched — it returns above, so this renders only
          once the score has settled and there is something to be credited for. */}
      <StoreMark name={identity.name} logoUrl={identity.logoUrl} size="sm" />
      <ResultSummary
        game={game}
        result={result}
        onPlayAgain={onPlayAgain}
        onPickAnother={onPickAnother}
      />
      {/* The board is the top ten; `own` is what stops a player ranked #23 from
          reading ten strangers and no sign of themselves. Both halves come from
          the submission that is already on this screen — no extra request. */}
      <Leaderboard
        scores={scores}
        unit={game.scoreUnit}
        own={{ entry: result.score, rank: result.rank }}
      />
    </Stack>
  );
}
