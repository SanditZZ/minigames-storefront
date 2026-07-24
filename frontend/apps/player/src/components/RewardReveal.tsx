import type { Game, SubmitResult } from "@minigames/api-client";
import { Button, Card, CenterStack } from "../ui";

interface Props {
  game: Game;
  result: SubmitResult;
  onPlayAgain: () => void;
}

/**
 * Celebrates the outcome using shared UI primitives. The prize decision was
 * made server-side; this only presents result.award (or a "no prize" state).
 */
export function RewardReveal({ game, result, onPlayAgain }: Props) {
  const won = Boolean(result.award);
  return (
    <CenterStack>
      <div className="text-center">
        <div className="text-sm font-medium uppercase tracking-widest text-ink/60">Your score</div>
        <div className="text-6xl font-black tabular-nums text-ink">{result.score.value}</div>
        <div className="mt-1 text-ink/70">
          {result.score.value} {game.scoreUnit} · Rank #{result.rank}
        </div>
      </div>

      {won ? (
        <Card className="w-full max-w-sm text-center">
          <div className="text-4xl">🎉</div>
          <div className="mt-2 text-sm font-semibold uppercase tracking-wide text-brand">You won</div>
          <div className="mt-1 text-2xl font-black text-ink">{result.award!.name}</div>
          {result.award!.description && <p className="mt-2 text-sm text-ink/60">{result.award!.description}</p>}
          <p className="mt-4 rounded-lg bg-brand-4 px-3 py-2 text-xs font-medium text-ink">
            Show this screen at the counter to claim your prize.
          </p>
        </Card>
      ) : (
        <Card tone="muted" className="w-full max-w-sm text-center">
          <div className="text-3xl">💪</div>
          <p className="mt-2 font-semibold text-ink">So close! No prize this time.</p>
          <p className="mt-1 text-sm text-ink/60">Give it another go for a higher score.</p>
        </Card>
      )}

      <Button size="lg" onClick={onPlayAgain}>
        Play again
      </Button>
    </CenterStack>
  );
}
