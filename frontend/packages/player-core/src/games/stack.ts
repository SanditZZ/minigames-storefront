// CALCULATIONS layer for the Stack game. Pure functions only — no rAF, no DOM,
// no React. The component runs the clock and paints; every rule about where the
// block is and what a drop does to the tower lives here.
//
// THIS FILE IS ONE HALF OF A PAIR. The other is backend/internal/game/stack.go,
// and the two must agree exactly, because the server replays the round from the
// drop timings and its answer is the one that counts. A divergence does not
// show up as a wrong number in a log — it shows up as a player watching a block
// land squarely on the tower and being told they missed. That is why:
//
//   - EVERY position is an integer, and every division truncates toward zero.
//     `Math.floor` on a non-negative quotient is what Go's `/` does on ints, and
//     the arithmetic here is arranged so no quotient is ever negative. Floating
//     point would drift; integers cannot.
//   - The TUNING is not written down here twice. The constants below are
//     fallbacks used only when the server sends no challenge; a real round is
//     driven by the numbers the server issued. See stackPhysics.
//
// The tests in stack.test.ts mirror the Go tests case for case, so a change to
// one side that the other did not follow fails a build rather than a player.

/**
 * The built-in physics, mirroring the constants in the Go catalog.
 *
 * These are a FALLBACK, not the source of truth: a live round is driven by the
 * challenge the server issued with the session. They exist so the game is
 * playable — and testable — without a server having spoken, and so a malformed
 * challenge degrades to a working round instead of a blank screen.
 */
export const STACK_DEFAULTS: StackPhysics = {
  trackWidth: 1000,
  baseWidth: 300,
  basePeriodMs: 1800,
  minPeriodMs: 700,
  periodStepMs: 90,
  maxDrops: Math.floor(15000 / (700 / 4)),
};

/** The numbers a Stack round is played by. Mirrors game.StackChallenge. */
export interface StackPhysics {
  /** The full playfield the block slides across, in virtual units. */
  trackWidth: number;
  /** The starting tower, and therefore the first block's width. */
  baseWidth: number;
  /** One full there-and-back sweep at the start of the round. */
  basePeriodMs: number;
  /** The floor the sweep ramps down to. */
  minPeriodMs: number;
  /** How much each placed block shortens the sweep. */
  periodStepMs: number;
  /** The most drops a round may report. */
  maxDrops: number;
}

/** The tower as an interval on the track. Both bounds are virtual units. */
export interface Tower {
  left: number;
  right: number;
}

/** What a drop did to the tower. */
export interface DropOutcome {
  /** The tower after the drop, or null when the block missed entirely. */
  tower: Tower | null;
  /** Where the block was when it was dropped — its own interval. */
  block: Tower;
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

/**
 * Narrows the server's challenge into the physics a round is played by.
 *
 * Follows the same precedence rule as the palette override in
 * `@minigames/tokens`: a field that is PRESENT and VALID wins; anything else —
 * absent, malformed, the wrong type — is not an override and the built-in
 * stands. Per field rather than all-or-nothing, so a server that grows a new
 * constant does not blank the ones this build already understood.
 *
 * Typed `unknown` in and validated here rather than trusted, because this is
 * the boundary where JSON off the wire becomes numbers the game does maths
 * with, and it is the only place that check can be made once.
 */
export function stackPhysics(challenge: unknown): StackPhysics {
  if (typeof challenge !== "object" || challenge === null) return STACK_DEFAULTS;
  const c = challenge as Record<string, unknown>;
  const pick = (key: keyof StackPhysics): number => {
    const v = c[key];
    return isPositiveInt(v) ? Math.floor(v) : STACK_DEFAULTS[key];
  };
  const physics: StackPhysics = {
    trackWidth: pick("trackWidth"),
    baseWidth: pick("baseWidth"),
    basePeriodMs: pick("basePeriodMs"),
    minPeriodMs: pick("minPeriodMs"),
    periodStepMs: pick("periodStepMs"),
    maxDrops: pick("maxDrops"),
  };
  // A base wider than the track has no sweep at all and would freeze the block
  // dead centre, which reads as a broken game rather than a hard one.
  if (physics.baseWidth > physics.trackWidth) {
    physics.baseWidth = STACK_DEFAULTS.baseWidth;
    physics.trackWidth = STACK_DEFAULTS.trackWidth;
  }
  return physics;
}

/** The tower every round begins on, centred on the track. */
export function baseTower(p: StackPhysics): Tower {
  const left = Math.floor((p.trackWidth - p.baseWidth) / 2);
  return { left, right: left + p.baseWidth };
}

/** How wide a tower is. */
export function towerWidth(tower: Tower): number {
  return tower.right - tower.left;
}

/**
 * The sweep period for the block being dropped at `placed` (0-based), applying
 * the ramp down to its floor. Mirrors game.StackPeriodMs.
 */
export function stackPeriodMs(placed: number, p: StackPhysics): number {
  const n = Number.isFinite(placed) && placed > 0 ? Math.floor(placed) : 0;
  const period = p.basePeriodMs - n * p.periodStepMs;
  return period < p.minPeriodMs ? p.minPeriodMs : period;
}

/**
 * Where the sliding block's centre is, `phaseMs` into its own sweep.
 *
 * A triangle wave: the block runs to one end, turns, and comes back at the same
 * speed. `fromLeft` alternates per block so a new one enters from the side
 * opposite the last, which is what makes an instant re-drop useless — the block
 * begins at an edge, maximally far from a tower that is usually near the
 * centre. The physics enforce a minimum interval that no explicit rule has to.
 *
 * Mirrors game.StackBlockCentre. Integer arithmetic throughout, truncating
 * exactly where Go does — see this file's header for why that is not a detail.
 */
export function stackBlockCentre(
  phaseMs: number,
  width: number,
  periodMs: number,
  fromLeft: boolean,
  p: StackPhysics,
): number {
  const travel = p.trackWidth - width;
  if (travel <= 0) return Math.floor(p.trackWidth / 2);

  const period = periodMs > 0 ? periodMs : p.minPeriodMs;
  const phase = Number.isFinite(phaseMs) && phaseMs > 0 ? Math.floor(phaseMs) : 0;

  const half = Math.floor(period / 2);
  if (half <= 0) return Math.floor(width / 2) + Math.floor(travel / 2);

  const t = phase % period;
  let off = t < half ? Math.floor((t * travel) / half) : travel - Math.floor(((t - half) * travel) / half);
  if (off < 0) off = 0;
  if (off > travel) off = travel;
  if (!fromLeft) off = travel - off;
  return Math.floor(width / 2) + off;
}

/**
 * Drops a block of the tower's own width at `centre` and returns what happened.
 *
 * The overhang is trimmed rather than kept, so the tower narrows with every
 * imperfect drop and the game gets harder from its own history. Overlapping by
 * nothing at all is a MISS — the ordinary way a round ends, not an error.
 *
 * Mirrors the replay loop inside game.ScoreStack. This function exists so the
 * renderer and the scorer cannot disagree about what a drop DID, even though
 * only the server's answer counts.
 *
 * Takes no StackPhysics, unlike everything else here: a drop is settled
 * entirely by the tower and where the block was over it. The track's width
 * constrains where the block COULD be, which is stackBlockCentre's business,
 * already done by the time this is called.
 */
export function dropBlock(tower: Tower, centre: number): DropOutcome {
  const width = towerWidth(tower);
  const blockLeft = centre - Math.floor(width / 2);
  const block = { left: blockLeft, right: blockLeft + width };

  const left = Math.max(tower.left, block.left);
  const right = Math.min(tower.right, block.right);
  if (right <= left) return { tower: null, block };
  return { tower: { left, right }, block };
}

/**
 * Replays a whole round from its drop timings, exactly as the server will.
 *
 * The component does NOT use this to score — it never scores; it reports the
 * timings and the server decides. This is here so the two simulations can be
 * tested against the same cases, and so a spec can predict what a set of
 * timings is worth without a round-trip.
 *
 * Mirrors game.ScoreStack, including the order of business: whether the events
 * describe a real round is settled across ALL of them before any are replayed,
 * so rejection never depends on where the player's tower happened to fall.
 * Returns null for events that could not have come from a real round.
 */
export function scoreStack(drops: number[], durationMs: number, p: StackPhysics): number | null {
  if (!(durationMs > 0)) return null;
  if (drops.length > p.maxDrops) return null;
  for (let i = 0; i < drops.length; i++) {
    const at = drops[i];
    if (!Number.isInteger(at) || at < 0 || at > durationMs) return null;
    if (i > 0 && at <= drops[i - 1]) return null;
  }

  let tower: Tower = baseTower(p);
  let spawnedAt = 0;
  for (let i = 0; i < drops.length; i++) {
    const at = drops[i];
    const centre = stackBlockCentre(
      at - spawnedAt,
      towerWidth(tower),
      stackPeriodMs(i, p),
      i % 2 === 0,
      p,
    );
    const outcome = dropBlock(tower, centre);
    if (!outcome.tower) return i;
    tower = outcome.tower;
    spawnedAt = at;
  }
  return drops.length;
}

/** An interval as a left-percentage and width-percentage of the track, for
 *  placing it visually. The one function here that is allowed to be fractional:
 *  it produces CSS, never a score. */
export function trackSpan(interval: Tower, p: StackPhysics): { left: number; width: number } {
  const scale = 100 / p.trackWidth;
  return {
    left: Math.max(0, Math.min(100, interval.left * scale)),
    width: Math.max(0, Math.min(100, towerWidth(interval) * scale)),
  };
}
