import { useCallback, useEffect, useRef, useState } from "react";
import { errorPulse, finishPulse, goPulse } from "../effects/haptics";
import { CenterStack, Eyebrow } from "../ui";
import { isFalseStart, reactionScore, waitDelayMs } from "./reaction";
import type { MiniGame, PlayProps } from "./types";

type Phase = "waiting" | "go";

/**
 * Reaction Timer: wait for the screen to flip, then tap as fast as you can.
 *
 * The first lower-is-better game in the catalog, which is why it exists as much
 * as for variety — the reveal meter, the prize ladder and the leaderboard all
 * branch on score direction, and until now nothing exercised the other branch.
 *
 * A tap before the flip is a false start. It does NOT end the round: the wait
 * is re-drawn instead. That is both kinder than a forced loss and impossible to
 * exploit, since a player spamming taps keeps resetting their own timer and
 * never sees the flip at all.
 *
 * All timing rules live in ./reaction as pure functions; this component only
 * runs the clock and paints the result.
 */
function ReactionTimerPlay({ durationMs, onFinish }: PlayProps) {
  const [phase, setPhase] = useState<Phase>("waiting");
  const [falseStarts, setFalseStarts] = useState(0);
  const flippedAtRef = useRef(0);
  const finishedRef = useRef(false);

  const finish = useCallback(
    (elapsedMs: number) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      finishPulse();
      onFinish(reactionScore(elapsedMs, durationMs));
    },
    [durationMs, onFinish],
  );

  // Arm the flip. Re-runs on every false start, drawing a fresh delay so the
  // player cannot learn the timing by repeating the mistake.
  useEffect(() => {
    if (phase !== "waiting") return;
    const id = window.setTimeout(() => {
      flippedAtRef.current = performance.now();
      goPulse();
      setPhase("go");
    }, waitDelayMs(Math.random()));
    return () => window.clearTimeout(id);
  }, [phase, falseStarts]);

  // A player who never reacts still gets a score: the ceiling. Leaving the
  // round open forever would strand them on a screen with no way out.
  useEffect(() => {
    if (phase !== "go") return;
    const id = window.setTimeout(() => finish(durationMs), durationMs);
    return () => window.clearTimeout(id);
  }, [phase, durationMs, finish]);

  const handleTap = useCallback(() => {
    if (finishedRef.current) return;
    if (isFalseStart(phase === "go")) {
      errorPulse();
      setFalseStarts((n) => n + 1);
      setPhase("waiting"); // re-arm with a fresh delay
      return;
    }
    finish(performance.now() - flippedAtRef.current);
  }, [phase, finish]);

  const go = phase === "go";

  return (
    <CenterStack>
      <div className="text-center">
        <Eyebrow>{go ? "Now!" : "Wait for it…"}</Eyebrow>
        {/* Reserved height: without it the layout jumps by a line the first
            time a false start message appears mid-round. */}
        <p className="mt-1 flex h-6 items-center justify-center text-sm font-semibold text-ink/60">
          {falseStarts > 0 && !go ? "Too soon! Waiting again…" : ""}
        </p>
      </div>

      <button
        type="button"
        onPointerDown={handleTap}
        aria-label={go ? "Tap now" : "Wait for the signal, then tap"}
        className={`grid aspect-square w-64 max-w-[78vw] select-none place-items-center rounded-full text-3xl font-black shadow-2xl outline-none ring-4 transition-transform duration-75 focus-visible:ring-brand/50 active:scale-95 ${
          go
            ? "animate-pop-in bg-brand text-ink ring-white/50"
            : "bg-brand-4 text-ink/50 ring-ink/10"
        }`}
      >
        {go ? "TAP!" : "WAIT"}
      </button>

      <p className="text-center text-sm text-ink/50">
        {go ? "Tap the moment it turns coral" : "Don’t tap until the circle lights up"}
      </p>
    </CenterStack>
  );
}

export const ReactionTimer: MiniGame = {
  slug: "reaction-timer",
  icon: "⚡",
  Play: ReactionTimerPlay,
};
