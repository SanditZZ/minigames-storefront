import type { Game, SubmitResult } from "@minigames/api-client";
import { isNewRecord } from "@minigames/player-core";
import { useT } from "../i18n";
import { AppearIn, Badge, Button, HighlightCard, Icon, Stack, Stat } from "../ui";
import { ClaimCard } from "./ClaimCard";

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
  const t = useT();
  const won = Boolean(result.award);
  const record = isNewRecord(result.rank);

  return (
    <Stack gap="lg" className="items-center">
      <AppearIn variant="pop" className="text-center">
        <Stat value={result.score.value} label={game.scoreUnit} />
        <div className="mt-3 flex items-center justify-center gap-2">
          <Badge tone={record ? "brand" : "muted"}>
            {/* The trophy used to live inside the translated string. It sits
                beside it now: a dictionary holds words, and an emoji wedged
                into one is a mark the store's palette cannot repaint. */}
            {record ? (
              <span className="inline-flex items-center gap-1">
                <Icon name="trophy" />
                {t("result.topScore")}
              </span>
            ) : (
              t("result.rank", { rank: result.rank })
            )}
          </Badge>
          <Badge tone="muted">{result.score.playerName}</Badge>
        </div>
      </AppearIn>

      {/* `riseSolid` when there is a claim, because this card carries the QR and
          a camera cannot decode a symbol at partial opacity over cream. A player
          who holds their phone out the instant the score lands used to get one
          failed scan and then a working one; the entrance is unchanged in every
          other respect, including its length. The two prize-less states keep the
          ordinary fade — nothing in them is machine-read. */}
      <AppearIn variant={result.claim ? "riseSolid" : "rise"} delayMs={140} className="w-full flex justify-center">
        {result.claim ? (
          // The image comes from the live award, the name from the claim's
          // snapshot inside ClaimCard — see the note there on why only one of
          // the two has to survive the prize being deleted.
          <ClaimCard view={result.claim} imageUrl={result.award?.imageUrl} />
        ) : won ? (
          // A win with no claim. Rare but real: issuing the code is the one
          // step allowed to fail without failing the submission, because by
          // then the score is written and the prize stock already spent (see
          // app.issueClaim). Rounds played before claims existed land here too.
          // Saying so is better than showing a prize with no way to collect it
          // and letting the player discover that at the counter.
          <HighlightCard
            icon="confetti"
            imageUrl={result.award!.imageUrl}
            eyebrow={t("result.won")}
            // The award's own name and blurb are admin free text and are shown
            // exactly as typed, in every language.
            title={result.award!.name}
            body={result.award!.description || undefined}
            note={t("result.noClaimNote")}
          />
        ) : (
          <HighlightCard
            icon="barbell"
            tone="muted"
            title={t("result.noPrize.title")}
            body={t("result.noPrize.body")}
          />
        )}
      </AppearIn>

      <AppearIn delayMs={260} className="w-full">
        <Stack gap="sm" className="items-center">
          <Button size="lg" fullWidth onClick={onPlayAgain}>
            {t("result.playAgain")}
          </Button>
          <Button variant="quiet" fullWidth onClick={onPickAnother}>
            {t("result.pickAnother")}
          </Button>
        </Stack>
      </AppearIn>
    </Stack>
  );
}
