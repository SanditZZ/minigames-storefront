import { useCallback, useEffect, useRef, useState } from "react";
import { finishPulse, tapPulse } from "../effects/haptics";
import { CenterStack, RingTimer, Stat, TapMarks } from "../ui";
import type { MiniGame, PlayProps } from "./types";

/** Time remaining at which the clock starts shouting. */
const URGENT_MS = 1500;

/**
 * Tap Fast: count taps within the round window.
 *
 * The round starts the moment the game mounts, because the shared countdown has
 * already counted the player in — an extra "tap to start" gate after 3-2-1-GO
 * would be a second start line for the same race.
 *
 * The component uses only shared UI primitives (Stat, RingTimer, TapMarks) and
 * defines no colours of its own, so it matches every other game automatically.
 * It only *counts*; the backend decides plausibility and prizes.
 */
function TapFastPlay({ durationMs, onFinish }: PlayProps) {
  const [count, setCount] = useState(0);
  const [remaining, setRemaining] = useState(durationMs);
  const [marks, setMarks] = useState<{ id: number; x: number }[]>([]);
  const finishedRef = useRef(false);
  const deadlineRef = useRef(0);
  const markSeq = useRef(0);

  useEffect(() => {
    deadlineRef.current = performance.now() + durationMs;
    const id = window.setInterval(() => {
      const left = Math.max(0, deadlineRef.current - performance.now());
      setRemaining(left);
      if (left <= 0) window.clearInterval(id);
    }, 50);
    return () => window.clearInterval(id);
  }, [durationMs]);

  useEffect(() => {
    if (remaining <= 0 && !finishedRef.current) {
      finishedRef.current = true;
      finishPulse();
      onFinish(count);
    }
  }, [remaining, count, onFinish]);

  const handleTap = useCallback(() => {
    if (finishedRef.current) return;
    setCount((c) => c + 1);
    tapPulse();

    // Each tap spawns a mark that removes itself once its animation is done, so
    // a fast player never accumulates hundreds of dead nodes.
    const id = markSeq.current++;
    setMarks((m) => [...m, { id, x: 35 + ((id * 37) % 30) }]);
    window.setTimeout(() => setMarks((m) => m.filter((mark) => mark.id !== id)), 650);
  }, []);

  const seconds = (remaining / 1000).toFixed(1);
  const pct = (remaining / durationMs) * 100;
  const urgent = remaining > 0 && remaining <= URGENT_MS;

  return (
    <CenterStack>
      <Stat value={count} label="taps" />

      <div className="relative">
        <TapMarks marks={marks} />
        <RingTimer pct={pct} urgent={urgent}>
          <button
            type="button"
            onPointerDown={handleTap}
            className="aspect-square w-52 max-w-[66vw] select-none rounded-full bg-brand text-3xl font-black text-ink shadow-2xl ring-4 ring-white/50 transition-transform duration-75 active:scale-90"
          >
            TAP!
          </button>
        </RingTimer>
      </div>

      <div className={`text-sm font-bold tabular-nums text-ink/70 ${urgent ? "animate-urgent" : ""}`}>
        {seconds}s left
      </div>
    </CenterStack>
  );
}

export const TapFast: MiniGame = {
  slug: "tap-fast",
  icon: "👆",
  Play: TapFastPlay,
};
