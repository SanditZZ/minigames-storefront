import { useCallback, useEffect, useRef, useState } from "react";
import {
  BULLSEYE_OFF,
  NEAR_OFF,
  STOP_HOLD_MS,
  WORST_SCORE,
  missDistance,
  precisionVerdict,
  sweepPosition,
  trackPercent,
  zoneWidthPercent,
} from "@minigames/player-core";
import { finishPulse } from "../effects/haptics";
import { useT } from "../i18n";
import { CenterStack, Eyebrow, ProgressBar } from "../ui";
import type { MiniGame, PlayProps } from "./types";

/** Where the marker came to rest, and how it got there. */
interface Landing {
  position: number;
  off: number;
  /** True when the clock ran out rather than the player stopping it. */
  timedOut: boolean;
}

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
 * A stop does not hand off immediately — the marker freezes and the track holds
 * for STOP_HOLD_MS so the player can see where they landed. See that constant
 * for why the beat exists and why it does not honour reduced motion the way the
 * celebration beats do.
 *
 * All the geometry lives in ../../packages/player-core/src/games/precision.ts
 * as pure functions; this component only runs the clock and paints.
 */
function PrecisionStopPlay({ durationMs, onFinish }: PlayProps) {
  const t = useT();
  const [position, setPosition] = useState(0);
  const [remaining, setRemaining] = useState(durationMs);
  const [landing, setLanding] = useState<Landing | null>(null);
  const landedRef = useRef(false);
  const positionRef = useRef(0);
  // Drawn once per round: a fixed opening would be learnable, and a player who
  // can count their way to the centre is not playing this game any more.
  const phaseRef = useRef(Math.random());

  // Ends the round: freezes the marker and shows where it stopped. The score is
  // NOT reported here — the hold below does that once the player has seen it.
  const land = useCallback((next: Landing) => {
    if (landedRef.current) return;
    landedRef.current = true;
    finishPulse();
    setLanding(next);
  }, []);

  // The hold, and the only place onFinish is called. Its cleanup matters: a
  // player who quits mid-hold unmounts this, and the round must not go on to
  // submit a score behind the screen they just left.
  useEffect(() => {
    if (!landing) return;
    const id = window.setTimeout(() => onFinish(landing.off), STOP_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [landing, onFinish]);

  // One rAF loop drives both the marker and the clock. rAF rather than an
  // interval because the marker's position IS the game — a stutter here is a
  // player stopping somewhere they did not aim at.
  useEffect(() => {
    const startedAt = performance.now();
    let raf = 0;

    const frame = () => {
      // Landing stops the loop, which is what freezes the marker where the
      // player stopped it for the duration of the hold.
      if (landedRef.current) return;
      const elapsed = performance.now() - startedAt;

      const pos = sweepPosition(elapsed, phaseRef.current);
      positionRef.current = pos;
      setPosition(pos);
      setRemaining(Math.max(0, durationMs - elapsed));

      // Never stopping is a legitimate outcome, and it scores the worst legal
      // value rather than stranding the player on a screen with no way out.
      // The marker still freezes where it was, but the readout says "out of
      // time" rather than a distance — the marker's position is not what was
      // scored, and showing a verdict for it would be a lie.
      if (elapsed >= durationMs) {
        land({ position: pos, off: WORST_SCORE, timedOut: true });
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [durationMs, land]);

  // Read the position from the ref, not from state: state is a frame behind by
  // the time a pointer event is handled, and on this game that lag is the score.
  const handleStop = useCallback(() => {
    const pos = positionRef.current;
    land({ position: pos, off: missDistance(pos), timedOut: false });
  }, [land]);

  const markerPct = trackPercent(landing ? landing.position : position);
  const seconds = (remaining / 1000).toFixed(1);
  const stopped = landing !== null && !landing.timedOut;

  return (
    <CenterStack>
      {/* Both lines keep a reserved height: they swap copy the instant the
          marker lands, and a taller or shorter line would jolt the track
          underneath at exactly the moment the player is reading it. */}
      <div className="text-center">
        {/* precisionVerdict returns a message key, not a word: which band a
            stop falls into is this game's rule, what the band is called is the
            dictionary's. See precision.ts. */}
        <Eyebrow>
          {landing
            ? landing.timedOut
              ? t("precision.outOfTime")
              : t(precisionVerdict(landing.off))
            : t("precision.aim")}
        </Eyebrow>
        <p className="mt-1 flex h-6 items-center justify-center text-sm text-ink/60">
          {stopped ? t("precision.offCentre", { off: landing.off }) : t("precision.hint")}
        </p>
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

        {/* The landing flare: a band that pops open around the frozen marker so
            the eye is pulled to where it stopped. Decoration only — the global
            reduce-motion rule in index.css neutralises the animation, leaving
            the band and the marker exactly where they are. */}
        {landing && (
          <div
            className="animate-pop-in absolute inset-y-0 w-9 -translate-x-1/2 rounded-full bg-brand-2/60"
            style={{ left: `${markerPct}%` }}
          />
        )}

        {/* No CSS transition on the marker: it is positioned every frame, and
            an easing curve would draw it somewhere it has not been. */}
        <div
          className={`absolute inset-y-1 -translate-x-1/2 rounded-full bg-ink ${landing ? "w-2" : "w-1.5"}`}
          style={{ left: `${markerPct}%` }}
        />
      </div>

      {/* Disabled once landed rather than unmounted: the round is over but the
          hold is still running, and removing the control the player just
          pressed would collapse the layout under the thing they are reading. */}
      <button
        type="button"
        onPointerDown={handleStop}
        disabled={landing !== null}
        aria-label={t("precision.aria")}
        className="aspect-square w-44 max-w-[58vw] select-none rounded-full bg-brand text-3xl font-black text-ink shadow-2xl outline-none ring-4 ring-white/50 transition-transform duration-75 focus-visible:ring-brand/50 active:scale-90 disabled:bg-brand-3 disabled:text-ink/50 disabled:shadow-none disabled:active:scale-100"
      >
        {t("precision.stop")}
      </button>

      <ProgressBar
        pct={(remaining / durationMs) * 100}
        caption={t("play.secondsLeft", { seconds })}
        label={t("precision.timeLeft")}
      />
    </CenterStack>
  );
}

export const PrecisionStop: MiniGame = {
  slug: "precision-stop",
  icon: "🎯",
  Play: PrecisionStopPlay,
};
