import { useCallback, useEffect, useRef, useState } from "react";
import {
  BULLSEYE_OFF,
  NEAR_OFF,
  WORST_SCORE,
  missDistance,
  sweepPosition,
  trackPercent,
  zoneWidthPercent,
} from "@minigames/player-core";
import { finishPulse } from "../effects/haptics";
import { CenterStack, Eyebrow, ProgressBar } from "../ui";
import type { MiniGame, PlayProps } from "./types";

/**
 * Precision Stop: a marker sweeps the track; stop it as close to centre as you
 * can. The score is how far off you landed, so lower wins — and a perfect stop
 * scores exactly 0.
 *
 * That zero is the reason this game exists. Tap counts start at 1 and reaction
 * times have a physiological floor, so until now every score in the catalog was
 * bounded away from zero, and the score reveal quietly assumed it always would
 * be: it scaled its tower against the leaderboard leader, which a single
 * perfect round would have set to 0 for everyone thereafter. The fix shipped
 * with this game — see benchmarkFor in @minigames/player-core.
 *
 * The two bands drawn on the track are the prize thresholds, not decoration:
 * the wide one is the smallest award, the narrow one is both the top prize and
 * the game's benchmark. A player can see what they are aiming at rather than
 * discovering the numbers on the result screen.
 *
 * All the geometry lives in ../../packages/player-core/src/games/precision.ts
 * as pure functions; this component only runs the clock and paints.
 */
function PrecisionStopPlay({ durationMs, onFinish }: PlayProps) {
  const [position, setPosition] = useState(0);
  const [remaining, setRemaining] = useState(durationMs);
  const finishedRef = useRef(false);
  const positionRef = useRef(0);
  // Drawn once per round: a fixed opening would be learnable, and a player who
  // can count their way to the centre is not playing this game any more.
  const phaseRef = useRef(Math.random());

  const finish = useCallback(
    (off: number) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      finishPulse();
      onFinish(off);
    },
    [onFinish],
  );

  // One rAF loop drives both the marker and the clock. rAF rather than an
  // interval because the marker's position IS the game — a stutter here is a
  // player stopping somewhere they did not aim at.
  useEffect(() => {
    const startedAt = performance.now();
    let raf = 0;

    const frame = () => {
      if (finishedRef.current) return;
      const elapsed = performance.now() - startedAt;

      const pos = sweepPosition(elapsed, phaseRef.current);
      positionRef.current = pos;
      setPosition(pos);
      setRemaining(Math.max(0, durationMs - elapsed));

      // Never stopping is a legitimate outcome, and it scores the worst legal
      // value rather than stranding the player on a screen with no way out.
      if (elapsed >= durationMs) {
        finish(WORST_SCORE);
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [durationMs, finish]);

  // Read the position from the ref, not from state: state is a frame behind by
  // the time a pointer event is handled, and on this game that lag is the score.
  const handleStop = useCallback(() => finish(missDistance(positionRef.current)), [finish]);

  const markerPct = trackPercent(position);
  const seconds = (remaining / 1000).toFixed(1);

  return (
    <CenterStack>
      <div className="text-center">
        <Eyebrow>Stop it dead centre</Eyebrow>
        <p className="mt-1 text-sm text-ink/60">The closer you land, the lower your score</p>
      </div>

      {/* The track is a picture of the numbers below it; a screen reader is
          given the button's label instead, which says the same thing in words. */}
      <div
        aria-hidden
        className="relative h-20 w-full max-w-xs overflow-hidden rounded-2xl bg-white shadow-inner ring-1 ring-ink/10"
      >
        {/* Prize bands, widest first so the tighter one paints over it. */}
        <div
          className="absolute inset-y-0 left-1/2 -translate-x-1/2 bg-brand-3"
          style={{ width: `${zoneWidthPercent(NEAR_OFF)}%` }}
        />
        <div
          className="absolute inset-y-0 left-1/2 -translate-x-1/2 bg-brand"
          style={{ width: `${zoneWidthPercent(BULLSEYE_OFF)}%` }}
        />
        {/* The exact centre — the thing actually being aimed at. */}
        <div className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-ink/40" />

        {/* No CSS transition on the marker: it is positioned every frame, and
            an easing curve would draw it somewhere it has not been. */}
        <div
          className="absolute inset-y-1 w-1.5 -translate-x-1/2 rounded-full bg-ink"
          style={{ left: `${markerPct}%` }}
        />
      </div>

      <button
        type="button"
        onPointerDown={handleStop}
        aria-label="Stop the marker as close to the centre of the track as you can"
        className="aspect-square w-44 max-w-[58vw] select-none rounded-full bg-brand text-3xl font-black text-ink shadow-2xl outline-none ring-4 ring-white/50 transition-transform duration-75 focus-visible:ring-brand/50 active:scale-90"
      >
        STOP!
      </button>

      <ProgressBar
        pct={(remaining / durationMs) * 100}
        caption={`${seconds}s left`}
        label="Time left to stop the marker"
      />
    </CenterStack>
  );
}

export const PrecisionStop: MiniGame = {
  slug: "precision-stop",
  icon: "🎯",
  Play: PrecisionStopPlay,
};
