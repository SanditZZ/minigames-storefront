// DATA + CALCULATIONS: how long the end of a round holds the screen.
//
// Two beats play back to back when a round finishes — the celebration
// (GameCompleteStage) and then the score reveal (ScoreReveal) — and NEITHER can
// be cut short by an input. That is a deliberate reversal of how this started.
//
// Both stages used to be full-screen "tap to skip" buttons, which reads well
// until you look at what the player's hands are doing at that exact moment. A
// round of Tap Fast ends with a finger hammering the middle of the screen
// several times a second; the celebration mounts underneath that finger, and
// the very next tap of a storm the player has not stopped yet skips it, then
// the one after skips the reveal. The score animation the whole ending is built
// around is gone before the player registers the round is over — and it reads
// as a bug, because they never chose it.
//
// So the skip is gone rather than merely delayed. A guard window would still
// have to answer "how long is a tap-storm?", and a wrong answer fails the same
// way. These durations are short enough that sitting through them is not the
// annoyance the skip was added to prevent.
//
// The timings live here rather than in @minigames/tokens for the reason that
// file already states: these are gameplay beats the score maths is written
// against, not decorative motion.

/**
 * The celebration beat: "Game complete!", confetti, no score yet.
 *
 * Matched to the confetti's own 1600ms so the beat ends as the last particle
 * does, rather than cutting the celebration off mid-fall or lingering after it.
 */
export const COMPLETE_BEAT_MS = 1600;

/** How long the meter takes to climb and settle, in ms. */
export const REVEAL_DURATION_MS = 2200;

/**
 * How long a beat actually holds for this player.
 *
 * Reduced motion collapses every hold to zero. That is the one input still
 * allowed to shorten the sequence, and it is not a skip: someone who has told
 * their OS that movement makes them unwell is not choosing to miss a
 * celebration, they are choosing not to be shown one. The rule lives here, in
 * one place, so a new beat cannot forget to honour it.
 *
 * A negative duration is treated as zero rather than trusted — the beats are
 * data, and data can be edited wrongly.
 */
export function holdMs(durationMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  return Math.max(0, durationMs);
}

/**
 * The whole unskippable stretch between the last tap of a round and the result
 * screen. Nothing in the app branches on this; it is what a test asserts a
 * floor against to prove no input shortened the sequence.
 */
export function endOfRoundMs(reducedMotion: boolean): number {
  return holdMs(COMPLETE_BEAT_MS, reducedMotion) + holdMs(REVEAL_DURATION_MS, reducedMotion);
}
