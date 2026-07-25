import { Confetti, Eyebrow, HaloBox } from "../ui";

/**
 * The beat between finishing a round and learning how you did.
 *
 * Two jobs. It celebrates — confetti, halo, a bobbing flag — so the round ends
 * on a high note instead of a table of numbers. And it withholds: the score is
 * deliberately absent here, because the whole point of the reveal that follows
 * is that the player doesn't already know the answer.
 *
 * It doubles as cover for the submit request. The score is uploading while this
 * is on screen, so the network round-trip costs the player nothing; if they tap
 * before it lands they simply see a brief "Scoring…" instead of a spinner they
 * had to wait through.
 */
export function GameCompleteStage({ pending, onContinue }: { pending: boolean; onContinue: () => void }) {
  return (
    <button
      type="button"
      onClick={onContinue}
      aria-label="Game complete. Continue to your score."
      className="relative flex flex-1 flex-col items-center justify-center gap-6 outline-none focus-visible:ring-4 focus-visible:ring-brand/50 rounded-3xl"
    >
      <div className="relative grid place-items-center">
        <HaloBox>
          <div className="animate-bob text-7xl" aria-hidden>
            🏁
          </div>
        </HaloBox>
        <Confetti />
      </div>

      <div className="animate-pop-in text-center">
        <Eyebrow>Round over</Eyebrow>
        <p className="mt-1 text-4xl font-black leading-tight text-ink">Game complete!</p>
      </div>

      <p className="animate-flash text-lg font-bold text-ink/70">
        {pending ? "Scoring…" : "Tap to reveal your score"}
      </p>
    </button>
  );
}
