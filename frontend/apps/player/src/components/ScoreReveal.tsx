import {
  countUpValue,
  meterFraction,
  meterHeight,
  tierFor,
  REVEAL_DURATION_MS,
  TIERS,
  type Direction,
} from "@minigames/player-core";
import { useAnimationProgress, usePrefersReducedMotion } from "../reveal/useAnimationProgress";
import { Confetti, Eyebrow, RevealMeter } from "../ui";

interface Props {
  value: number;
  unit: string;
  direction: Direction;
  /**
   * The score the top of the tower represents — the game's own benchmark, or
   * the board leader when it has none. Null means no honest scale exists;
   * see benchmarkFor, which is what decides this.
   */
  benchmark: number | null;
  /** Whether this round took first place — lights the bell. */
  isRecord: boolean;
  onDone: () => void;
}

/**
 * The punching-machine score reveal: the puck slams up the tower, overshoots,
 * settles on the player's mark, and only then is the number legible.
 *
 * All timing/easing/tier maths lives in @minigames/player-core; this component
 * just feeds it progress and paints the result.
 *
 * There is no tap-to-skip. It was here on the reasoning that a reveal you can't
 * cut short is an annoyance on the second play — true in isolation, but it made
 * the skip target a full-screen button reached, on the first play, by a finger
 * still mid-tap-storm from the round that just ended. The reveal was being
 * skipped by accident far more often than on purpose. Reduced motion still
 * jumps straight to the settled state; that is a preference, not a stray tap.
 */
export function ScoreReveal({ value, unit, direction, benchmark, isRecord, onDone }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const progress = useAnimationProgress(REVEAL_DURATION_MS, reducedMotion, onDone);

  const target = meterFraction(value, benchmark, direction);
  const height = meterHeight(target, progress);
  const shown = countUpValue(value, progress);
  const tier = tierFor(height);
  const settled = progress >= 1;

  return (
    <section
      aria-label="Revealing your score."
      // The tap-storm can still be running through the reveal. The score is
      // shown again, selectably, on the result screen right after this.
      className="no-select relative flex flex-1 flex-col items-center justify-center gap-8"
    >
      <div className="text-center">
        <Eyebrow>{settled ? tier.label : "Measuring…"}</Eyebrow>
        <div className="mt-1 text-7xl font-black tabular-nums leading-none text-ink" aria-hidden>
          {shown}
        </div>
        <div className="mt-2 text-ink/60">{unit}</div>
      </div>

      {/* An explicit width matters: the ladder's labels are absolutely
          positioned and so contribute no intrinsic width. Without it the
          column collapses and every label truncates to nothing. The top
          padding reserves room for the bell that sits above the tower. */}
      <div className="relative w-full max-w-xs pt-14">
        <RevealMeter heightPct={height * 100} tiers={TIERS} activeTier={tier} bellLit={settled && isRecord} />
        {settled && isRecord && <Confetti />}
      </div>

      {/* The digits themselves are aria-hidden: a number ticking up sixty times
          a second is noise to a screen reader. The result is announced once,
          when it means something. The line also holds the slot open so the
          layout does not jump as the reveal settles. */}
      <p className="text-sm font-medium text-ink/40" role="status">
        {settled ? `${shown} ${unit}` : "Hold tight…"}
      </p>
    </section>
  );
}
