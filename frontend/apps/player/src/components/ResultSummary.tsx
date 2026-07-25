import type { Game, SubmitResult } from "@minigames/api-client";
import { isNewRecord } from "@minigames/player-core";
import { AppearIn, Badge, Button, HighlightCard, Stack, Stat } from "../ui";

interface Props {
  game: Game;
  result: SubmitResult;
  onPlayAgain: () => void;
  onPickAnother: () => void;
}

/**
 * The settled result, shown once the reveal has finished (or immediately when
 * someone opens the result URL later).
 *
 * The prize decision was made server-side and stored with the round, so this
 * only presents result.award — it never re-derives who won what.
 */
export function ResultSummary({ game, result, onPlayAgain, onPickAnother }: Props) {
  const won = Boolean(result.award);
  const record = isNewRecord(result.rank);

  return (
    <Stack gap="lg" className="items-center">
      <AppearIn variant="pop" className="text-center">
        <Stat value={result.score.value} label={game.scoreUnit} />
        <div className="mt-3 flex items-center justify-center gap-2">
          <Badge tone={record ? "brand" : "muted"}>{record ? "🏆 Top score" : `Rank #${result.rank}`}</Badge>
          <Badge tone="muted">{result.score.playerName}</Badge>
        </div>
      </AppearIn>

      <AppearIn delayMs={140} className="w-full flex justify-center">
        {won ? (
          <HighlightCard
            icon="🎉"
            eyebrow="You won"
            title={result.award!.name}
            body={result.award!.description || undefined}
            note="Show this screen at the counter to claim your prize."
          />
        ) : (
          <HighlightCard
            icon="💪"
            tone="muted"
            title="So close!"
            body="No prize this time — give it another go for a higher score."
          />
        )}
      </AppearIn>

      <AppearIn delayMs={260} className="w-full">
        <Stack gap="sm" className="items-center">
          <Button size="lg" fullWidth onClick={onPlayAgain}>
            Play again
          </Button>
          <Button variant="quiet" fullWidth onClick={onPickAnother}>
            Pick another game
          </Button>
        </Stack>
      </AppearIn>
    </Stack>
  );
}
