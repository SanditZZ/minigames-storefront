import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type StackPhysics,
  type Tower,
  baseTower,
  dropBlock,
  stackBlockCentre,
  stackPeriodMs,
  stackPhysics,
  towerWidth,
  trackSpan,
} from "@minigames/player-core";
import { finishPulse } from "../effects/haptics";
import { useT } from "../i18n";
// NOTE: do not add `Stack` to this import. The UI kit exports a LAYOUT
// primitive by that name, and this file's own export is the game — importing
// both would shadow one silently. CenterStack is the one wanted here.
import { CenterStack, Eyebrow, ProgressBar, StatusMessage } from "../ui";
import type { MiniGame, PlayProps } from "./types";

/** How the round ended, for the line above the tower. */
type Ending = "missed" | "timeout";

/** A block already resting on the tower, kept only so it can be drawn. */
interface Placed {
  interval: Tower;
  /** True when this drop cost the tower none of its width. */
  perfect: boolean;
}

/** How long the tower holds after the round ends, before handing off. */
const SETTLE_MS = 700;

/**
 * Stack: a block slides across the track and the player drops it onto the
 * tower. The overhang is trimmed, so the tower narrows with every imperfect
 * drop and the game gets harder from its own history. Miss the tower entirely
 * and the round is over.
 *
 * THIS COMPONENT DOES NOT SCORE THE ROUND. It reports the drop TIMINGS and
 * nothing else; the server replays them and decides how many blocks stacked
 * (see backend/internal/game/stack.go). That is the whole point of the game's
 * design — there is no number here for anyone to tamper with, because the
 * client never states one.
 *
 * The tower drawn on screen is therefore a PREVIEW of the server's answer, not
 * the answer. If the two ever stop agreeing, the result screen is right and this
 * preview is the thing that is wrong.
 *
 * Keeping them in agreement takes TWO things, and the second was learned the hard
 * way. Identical integer arithmetic, pinned to a shared golden fixture — and
 * identical INPUTS, which the fixture cannot check because it only ever sees the
 * pure functions. The input rule is one line: `handleDrop` recomputes the block's
 * centre from the very timestamp it reports, so the preview is a prediction of the
 * server's answer rather than an independent guess. It judged from the last
 * frame's centre while reporting a fresh clock read for a while, and the two
 * drifting by a frame was enough to turn a landing into a miss on a narrow tower.
 *
 * That timestamp is itself the last PAINTED frame's, which is a separate choice
 * and the one that makes the drop land where the player was aiming rather than a
 * frame further on. Both comments are in `handleDrop`.
 *
 * All the geometry lives in packages/player-core/src/games/stack.ts as pure
 * functions; this component only runs the clock and paints.
 *
 * StackPlay is the guard and StackRound is the round. They are separate
 * components because `physics` seeds `useState` initialisers and is closed over by
 * the rAF loop: a null check inside StackRound would have to be threaded through
 * every one of them, and an early return after those hooks is not allowed.
 */
function StackPlay(props: PlayProps) {
  const t = useT();
  // Memoised because it is the identity the rAF loop closes over — re-deriving it
  // per render would restart the round on every frame.
  const physics = useMemo(() => stackPhysics(props.challenge), [props.challenge]);

  // A challenge that was SENT and cannot be read means the round would be played
  // by different physics than the server is scoring: every drop would land
  // somewhere it did not put it. Absent is fine and never reaches here —
  // stackPhysics returns the built-ins for that case, which are the same numbers.
  if (!physics) {
    return (
      <StatusMessage
        tone="error"
        icon="frown"
        title={t("play.failed.title")}
        detail={t("play.badChallenge")}
      />
    );
  }
  return <StackRound {...props} physics={physics} />;
}

function StackRound({ durationMs, onFinish, physics }: PlayProps & { physics: StackPhysics }) {
  const t = useT();

  const [placed, setPlaced] = useState<Placed[]>([]);
  const [tower, setTower] = useState<Tower>(() => baseTower(physics));
  const [blockCentre, setBlockCentre] = useState(0);
  const [remaining, setRemaining] = useState(durationMs);
  const [ending, setEnding] = useState<Ending | null>(null);
  const [lastPerfect, setLastPerfect] = useState<boolean | null>(null);

  // The round's authoritative state lives in refs, because the pointer handler
  // reads it at the instant of a tap: React state is a frame behind by then,
  // and on this game that lag is the drop.
  const dropsRef = useRef<number[]>([]);
  const towerRef = useRef<Tower>(baseTower(physics));
  const spawnedAtRef = useRef(0);
  const startedAtRef = useRef(0);
  const elapsedRef = useRef(0);
  const overRef = useRef(false);

  // Ends the round. The timings are NOT reported here — the settle beat below
  // does that, once the player has seen where the last block landed.
  const end = useCallback((how: Ending) => {
    if (overRef.current) return;
    overRef.current = true;
    finishPulse();
    setEnding(how);
  }, []);

  // The settle beat, and the only place onFinish is called. Its cleanup
  // matters: a player who quits mid-beat unmounts this, and the round must not
  // go on to submit behind the screen they just left.
  useEffect(() => {
    if (!ending) return;
    const id = window.setTimeout(() => onFinish(dropsRef.current), SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [ending, onFinish]);

  // One rAF loop drives both the block and the clock. rAF rather than an
  // interval because the block's position IS the game — a stutter here is a
  // player dropping somewhere they did not aim at.
  useEffect(() => {
    startedAtRef.current = performance.now();
    let raf = 0;

    const frame = () => {
      if (overRef.current) return;
      const elapsed = performance.now() - startedAtRef.current;
      // The frame's own time, kept for handleDrop. See the comment there: a drop
      // is timed at the moment the player was LOOKING at, not at the moment the
      // event handler happened to run.
      elapsedRef.current = Math.floor(elapsed);

      const placedCount = dropsRef.current.length;
      const centre = stackBlockCentre(
        elapsedRef.current - spawnedAtRef.current,
        towerWidth(towerRef.current),
        stackPeriodMs(placedCount, physics),
        placedCount % 2 === 0,
        physics,
      );
      setBlockCentre(centre);
      setRemaining(Math.max(0, durationMs - elapsed));

      // Running the clock out is an ordinary ending, not a failure: every block
      // already stacked still counts, which is what makes the fixed ceiling a
      // bound on the queue rather than a punishment.
      if (elapsed >= durationMs) {
        end("timeout");
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [durationMs, physics, end]);

  const handleDrop = useCallback(() => {
    if (overRef.current) return;
    // The drop is timed at the LAST PAINTED FRAME, not at a clock read taken
    // here, and the two are different by up to a frame.
    //
    // The player is aiming at what is on screen, which is frame N. Reading
    // `performance.now()` in this handler dates the drop somewhere after frame N —
    // and since the server replays from whatever timestamp it is given, the block
    // would be scored a frame further along its travel than the one the player was
    // looking at. Self-consistent, but systematically late, always in the
    // direction the block is moving. Using the frame's own time instead makes the
    // reported moment the same moment the player saw, which is what Precision Stop
    // does with `elapsedRef` and for the same reason.
    //
    // Already floored to whole milliseconds by the loop: the server replays
    // integers, so a fractional drop time would be a different round.
    const at = elapsedRef.current;
    if (at < 0 || at > durationMs) return;
    // A drop landing in the same millisecond as the previous one would be
    // rejected by the server as impossible. Dropping it is right: the player
    // did tap twice, but the round cannot represent two events at one instant,
    // and losing the second tap is better than losing the whole submission.
    const drops = dropsRef.current;
    if (drops.length > 0 && at <= drops[drops.length - 1]) return;

    // The centre is RECOMPUTED at `at` rather than read from the last frame, and
    // that is not a micro-optimisation — it is the difference between this preview
    // and the score agreeing or not.
    //
    // `at` is what gets reported, and the server replays the sweep from it. The
    // rAF loop's centre belongs to the previous FRAME, up to ~16ms earlier, which
    // at this block's speed is twenty-odd virtual units of drift. While the tower
    // is wide both positions still overlap it and the two simulations agree; once
    // the tower has narrowed to a few tens of units the same drift flips a landing
    // into a miss, and the player watches a block settle squarely on the tower and
    // is told on the next screen that they missed it. The golden fixture cannot
    // catch that — both sides' arithmetic is correct — because the divergence is in
    // the INPUT, not the function. Judging from the timestamp that is actually
    // reported is what makes the client's preview a prediction of the server's
    // answer rather than an independent guess.
    const centre = stackBlockCentre(
      at - spawnedAtRef.current,
      towerWidth(towerRef.current),
      stackPeriodMs(drops.length, physics),
      drops.length % 2 === 0,
      physics,
    );
    const outcome = dropBlock(towerRef.current, centre);
    if (!outcome.tower) {
      // The missed block is still drawn where it fell, so the player can see
      // that they were short rather than merely being told the round is over.
      setPlaced((prev) => [...prev, { interval: outcome.block, perfect: false }]);
      setLastPerfect(null);
      end("missed");
      return;
    }

    const perfect = towerWidth(outcome.tower) === towerWidth(towerRef.current);
    drops.push(at);
    towerRef.current = outcome.tower;
    spawnedAtRef.current = at;
    setTower(outcome.tower);
    setPlaced((prev) => [...prev, { interval: outcome.tower!, perfect }]);
    setLastPerfect(perfect);
  }, [durationMs, end, physics]);

  const blockInterval = useMemo<Tower>(() => {
    const width = towerWidth(tower);
    const left = blockCentre - Math.floor(width / 2);
    return { left, right: left + width };
  }, [blockCentre, tower]);

  const seconds = (remaining / 1000).toFixed(1);

  // The count shown is the drops the server will be given, not `placed.length`
  // — a missed block is drawn where it fell but never reported, so the two
  // legitimately differ by one at the end of a round.
  const reported = dropsRef.current.length;

  // The tower is drawn bottom-up into a fixed frame, so it gets FINER as it
  // grows rather than taller than the box. One slot each for the base, every
  // placed block and the one still in play, with a floor so an early tower does
  // not fill the frame with three enormous slabs.
  const slots = Math.max(placed.length + 2, 8);
  const unit = 100 / slots;
  const blockSpan = trackSpan(blockInterval, physics);

  return (
    <CenterStack>
      {/* Both lines keep a reserved height: they swap copy the instant a block
          lands, and a taller or shorter line would jolt the tower underneath at
          exactly the moment the player is reading it. */}
      <div className="text-center">
        <Eyebrow>
          {ending === "missed"
            ? t("stack.missed")
            : ending === "timeout"
              ? t("stack.outOfTime")
              : lastPerfect === true
                ? t("stack.perfect")
                : lastPerfect === false
                  ? t("stack.trimmed")
                  : t("stack.aim")}
        </Eyebrow>
        <p className="mt-1 flex h-6 items-center justify-center text-sm text-ink/60">
          {reported > 0 ? t("stack.stacked", { count: reported }) : t("stack.hint")}
        </p>
      </div>

      {/* The tower is a picture of the numbers around it; a screen reader is
          given the button's label instead, which says the same thing in words. */}
      <div
        aria-hidden
        className="relative h-64 w-full max-w-xs overflow-hidden rounded-2xl bg-white shadow-inner ring-1 ring-ink/10"
      >
        {/* The base, and every block resting on it, drawn bottom-up. A drop
            that cost the tower nothing is `brand`; a trimmed one is `brand-2`,
            so the tower itself is a record of how the round went. */}
        {[{ interval: baseTower(physics), perfect: true }, ...placed].map((block, i, all) => {
          const span = trackSpan(block.interval, physics);
          return (
            <div
              key={i}
              // The topmost block is the one the next drop is aimed at, so it is
              // the only one worth naming. The browser suite reads its RENDERED
              // geometry to decide when to tap — real pixels rather than a
              // state seam, which is what keeps a timing game testable without
              // the component publishing its own internals.
              data-testid={i === all.length - 1 ? "stack-tower-top" : undefined}
              className={`absolute rounded-sm ${block.perfect ? "bg-brand" : "bg-brand-2"}`}
              style={{
                left: `${span.left}%`,
                width: `${span.width}%`,
                bottom: `${i * unit}%`,
                height: `${unit}%`,
              }}
            />
          );
        })}

        {/* The block in play, riding one slot above the tower. No CSS
            transition: it is positioned every frame, and an easing curve would
            draw it somewhere it has not been. */}
        {!ending && (
          <div
            data-testid="stack-block"
            className="absolute rounded-sm bg-ink"
            style={{
              left: `${blockSpan.left}%`,
              width: `${blockSpan.width}%`,
              bottom: `${(placed.length + 1) * unit}%`,
              height: `${unit}%`,
            }}
          />
        )}
      </div>

      {/* Disabled once the round ends rather than unmounted: the settle beat is
          still running, and removing the control the player just pressed would
          collapse the layout under the thing they are reading. */}
      <button
        type="button"
        onPointerDown={handleDrop}
        disabled={ending !== null}
        aria-label={t("stack.aria")}
        data-testid="stack-drop"
        data-stacked={reported}
        className="aspect-square w-44 max-w-[58vw] select-none rounded-full bg-brand text-3xl font-black text-ink shadow-2xl outline-none ring-4 ring-white/50 transition-transform duration-75 focus-visible:ring-brand/50 active:scale-90 disabled:bg-brand-3 disabled:text-ink/50 disabled:shadow-none disabled:active:scale-100"
      >
        {t("stack.drop")}
      </button>

      <ProgressBar
        pct={(remaining / durationMs) * 100}
        caption={t("play.secondsLeft", { seconds })}
        label={t("stack.timeLeft")}
      />
    </CenterStack>
  );
}

export const Stack: MiniGame = {
  slug: "stack",
  icon: "blocks",
  Play: StackPlay,
};
