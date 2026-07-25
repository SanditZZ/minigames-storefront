import { useState } from "react";
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
  /** Best score on the board, used as the top of the tower. */
  best: number | null;
  /** Whether this round took first place — lights the bell. */
  isRecord: boolean;
  onDone: () => void;
}

/**
 * The punching-machine score reveal: the puck slams up the tower, overshoots,
 * settles on the player's mark, and only then is the number legible.
 *
 * All timing/easing/tier maths lives in @minigames/player-core; this component
 * just feeds it progress and paints the result. Tapping skips to the end — a
 * reveal you can't cut short is an annoyance on the second play, not a delight.
 */
export function ScoreReveal({ value, unit, direction, best, isRecord, onDone }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const [skipped, setSkipped] = useState(false);
  const skip = reducedMotion || skipped;

  const progress = useAnimationProgress(REVEAL_DURATION_MS, skip, onDone);

  const target = meterFraction(value, best, direction);
  const height = meterHeight(target, progress);
  const shown = countUpValue(value, progress);
  const tier = tierFor(height);
  const settled = progress >= 1;

  return (
    <button
      type="button"
      onClick={() => setSkipped(true)}
      aria-label="Revealing your score. Tap to skip."
      className="relative flex flex-1 flex-col items-center justify-center gap-8 rounded-3xl outline-none focus-visible:ring-4 focus-visible:ring-brand/50"
    >
      <div className="text-center">
        <Eyebrow>{settled ? tier.label : "Measuring…"}</Eyebrow>
        <div className="mt-1 text-7xl font-black tabular-nums leading-none text-ink">{shown}</div>
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

      {!settled && <p className="text-sm font-medium text-ink/40">Tap to skip</p>}
    </button>
  );
}
