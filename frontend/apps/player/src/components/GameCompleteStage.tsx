import { COMPLETE_BEAT_MS, holdMs } from "@minigames/player-core";
import { useT } from "../i18n";
import { useHold, usePrefersReducedMotion } from "../reveal/useAnimationProgress";
import { Confetti, Eyebrow, HaloBox, Icon } from "../ui";

/**
 * The beat between finishing a round and learning how you did.
 *
 * Two jobs. It celebrates — confetti, halo, a bobbing flag — so the round ends
 * on a high note instead of a table of numbers. And it withholds: the score is
 * deliberately absent here, because the whole point of the reveal that follows
 * is that the player doesn't already know the answer.
 *
 * It doubles as cover for the submit request. The score uploads while this is
 * on screen, so the network round-trip costs the player nothing.
 *
 * It ends on a timer, not on a tap. It used to be a full-screen button — which
 * put a skip target directly under the finger of someone who was, one moment
 * earlier, hammering that exact spot several times a second. The stray tap that
 * ended a Tap Fast round then skipped the celebration and the reveal behind it.
 * See pacing.ts in @minigames/player-core.
 *
 * `pending` only changes the copy. Handing over early is the parent's decision
 * (it waits for the score AND this beat, whichever lands second), so a slow
 * upload lengthens the wait rather than this stage having to know about it.
 */
export function GameCompleteStage({ pending, onContinue }: { pending: boolean; onContinue: () => void }) {
  const t = useT();
  const reducedMotion = usePrefersReducedMotion();
  useHold(holdMs(COMPLETE_BEAT_MS, reducedMotion), onContinue);

  return (
    <section
      aria-label={t("complete.aria")}
      // Still inside the tap-storm's blast radius, and not inside GameStage —
      // this renders in its place — so it carries `no-select` itself.
      className="no-select relative flex flex-1 flex-col items-center justify-center gap-6"
    >
      <div className="relative grid place-items-center">
        <HaloBox>
          <div className="animate-bob text-7xl text-ink">
            <Icon name="flag-checkered" />
          </div>
        </HaloBox>
        <Confetti />
      </div>

      <div className="animate-pop-in text-center">
        <Eyebrow>{t("complete.eyebrow")}</Eyebrow>
        <p className="mt-1 text-4xl font-black leading-tight text-ink">{t("complete.title")}</p>
      </div>

      <p className="animate-flash text-lg font-bold text-ink/70">
        {pending ? t("complete.scoring") : t("complete.revealing")}
      </p>
    </section>
  );
}
