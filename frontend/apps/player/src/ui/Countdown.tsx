import { useEffect, useState } from "react";
import { goPulse, tapPulse } from "../effects/haptics";
import { useT } from "../i18n";
import { Eyebrow } from "./Card";
import { CenterStack } from "./Layout";

/**
 * Ticks shown before a round: 3, 2, 1, then GO.
 *
 * The digits are digits in every language — Thai has its own numerals but
 * Arabic ones are what a Thai phone shows and what the score readouts use, so
 * translating these would make the count-in disagree with the scoreboard.
 * Only the final word is a word, and it is looked up.
 */
const TICKS = ["3", "2", "1"];

/** Total beats, digits plus the GO — a constant, so the effect below has no
 *  dependency on the translated array being referentially stable. */
const TICK_COUNT = TICKS.length + 1;

/** How long each tick holds. Four ticks ≈ 2s of build-up. */
const TICK_MS = 500;

/**
 * The "get ready" beat every game runs before its first frame.
 *
 * It exists because a 5-second round spent working out what to do is a 4-second
 * round. Counting in gives the player somewhere to put their attention and a
 * shared, predictable moment to start on — which also means a game can begin
 * timing immediately instead of waiting for a first tap to prove readiness.
 *
 * Lives in the shared kit rather than inside a game so every game inherits the
 * same rhythm, exactly like the colour tokens.
 */
export function Countdown({ label, onDone }: { label?: string; onDone: () => void }) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const ticks = [...TICKS, t("countdown.go")];

  useEffect(() => {
    if (index >= TICK_COUNT) {
      onDone();
      return;
    }
    // The final tick is GO — a firmer buzz, so the start is felt as well as seen.
    if (index === TICK_COUNT - 1) goPulse();
    else tapPulse();

    const id = window.setTimeout(() => setIndex((n) => n + 1), TICK_MS);
    return () => window.clearTimeout(id);
  }, [index, onDone]);

  const tick = ticks[Math.min(index, TICK_COUNT - 1)];
  const isGo = index === TICK_COUNT - 1;

  return (
    <CenterStack>
      {label && <Eyebrow>{label}</Eyebrow>}
      {/* Keyed so each tick remounts and replays the pop, rather than the text
          silently swapping inside a single element. */}
      <div
        key={tick}
        className={`animate-pop-in font-black tabular-nums leading-none text-ink ${
          isGo ? "text-7xl" : "text-8xl"
        }`}
        aria-hidden
      >
        {tick}
      </div>
      {/* The count is decorative; this is what a screen reader announces. */}
      <p className="sr-only" role="status">
        {t("countdown.starting", { seconds: TICK_COUNT - index - 1 })}
      </p>
    </CenterStack>
  );
}
