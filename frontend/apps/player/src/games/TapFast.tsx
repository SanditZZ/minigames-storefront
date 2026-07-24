import { useCallback, useEffect, useRef, useState } from "react";
import { CenterStack, ProgressBar, Stat } from "../ui";
import type { MiniGame, PlayProps } from "./types";

/**
 * Tap Fast: count taps within the round window. The timer starts on the first
 * tap (so idle time before starting never counts against the player), and the
 * final count is reported once when time runs out.
 *
 * The component uses only shared UI primitives (Stat, ProgressBar) and defines
 * no colours of its own — so it matches every other game automatically. It only
 * *counts*; the backend decides plausibility and prizes.
 */
function TapFastPlay({ durationMs, onFinish }: PlayProps) {
  const [count, setCount] = useState(0);
  const [remaining, setRemaining] = useState(durationMs);
  const [started, setStarted] = useState(false);
  const finishedRef = useRef(false);
  const deadlineRef = useRef(0);

  useEffect(() => {
    if (!started) return;
    deadlineRef.current = performance.now() + durationMs;
    const id = window.setInterval(() => {
      const left = Math.max(0, deadlineRef.current - performance.now());
      setRemaining(left);
      if (left <= 0) window.clearInterval(id);
    }, 50);
    return () => window.clearInterval(id);
  }, [started, durationMs]);

  useEffect(() => {
    if (started && remaining <= 0 && !finishedRef.current) {
      finishedRef.current = true;
      onFinish(count);
    }
  }, [started, remaining, count, onFinish]);

  const handleTap = useCallback(() => {
    if (finishedRef.current) return;
    if (!started) setStarted(true);
    setCount((c) => c + 1);
  }, [started]);

  const seconds = (remaining / 1000).toFixed(1);
  const pct = started ? (remaining / durationMs) * 100 : 100;

  return (
    <CenterStack>
      <Stat value={count} label="taps" />
      <ProgressBar pct={pct} caption={started ? `${seconds}s left` : "Tap to start!"} />
      <button
        type="button"
        onPointerDown={handleTap}
        className="aspect-square w-56 max-w-[70vw] select-none rounded-full bg-brand text-3xl font-black text-ink shadow-2xl ring-4 ring-white/50 transition-transform duration-75 active:scale-90"
      >
        TAP!
      </button>
    </CenterStack>
  );
}

export const TapFast: MiniGame = {
  slug: "tap-fast",
  Play: TapFastPlay,
};
