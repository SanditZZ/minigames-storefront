// ACTIONS layer: drives a 0→1 progress value off requestAnimationFrame, and
// reads the user's motion preference. All the maths that consumes progress
// lives in ./calc.

import { useEffect, useState } from "react";

/**
 * Reports whether the player asked their OS to reduce motion. Respected by the
 * reveal, which is otherwise a lot of bouncing for someone who is motion
 * sensitive — they get the result immediately instead.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * Calls `onDone` once, `ms` after mount. The celebration beat's whole
 * implementation: it used to end when the player tapped, and now it ends when
 * it is over. See pacing.ts in @minigames/player-core for why.
 *
 * `ms` of 0 still defers to a later tick rather than firing during render,
 * which is what makes the reduced-motion path safe to express as a zero hold
 * instead of a separate branch.
 */
export function useHold(ms: number, onDone: () => void): void {
  useEffect(() => {
    const timer = setTimeout(onDone, ms);
    return () => clearTimeout(timer);
    // onDone is intentionally excluded, for the same reason as below: callers
    // pass inline closures, and a new identity each render would restart the
    // hold and strand the player on the stage forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms]);
}

/**
 * Animates progress from 0 to 1 over `durationMs`, then calls `onDone` once.
 *
 * `skip` jumps straight to 1. It is now reached ONLY by the reduced-motion
 * preference — the tap-to-skip that used to share it is gone. Timing comes from
 * the rAF timestamp rather than a frame counter, so the reveal takes the same
 * wall-clock time on a slow device as on a fast one.
 */
export function useAnimationProgress(durationMs: number, skip: boolean, onDone?: () => void): number {
  const [progress, setProgress] = useState(skip ? 1 : 0);

  useEffect(() => {
    if (skip) {
      setProgress(1);
      onDone?.();
      return;
    }

    let frame = 0;
    let start = 0;
    let finished = false;

    const step = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / durationMs);
      setProgress(t);
      if (t < 1) {
        frame = requestAnimationFrame(step);
      } else if (!finished) {
        finished = true;
        onDone?.();
      }
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // onDone is intentionally excluded: callers pass inline closures, and a new
    // identity each render would restart the animation mid-flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMs, skip]);

  return progress;
}
