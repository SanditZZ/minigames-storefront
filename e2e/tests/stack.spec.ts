import { expect, test, type Locator, type Page } from "@playwright/test";
import { ui } from "../helpers/round";

/**
 * Stack is the first game the SERVER scores. The client reports when the player
 * dropped each block and never states a number, so what this suite is really
 * for is the seam that design creates: the physics are simulated twice, once in
 * Go to score and once in TypeScript to render, and the two must agree.
 *
 * A golden fixture already pins the two simulations to each other as pure
 * functions (backend/internal/game/testdata/stack_golden.json). What it cannot
 * cover is the round-trip — that the timings this component captures are the
 * ones the server replays, and that its clock starts where the server thinks it
 * does. That is what the first test below asserts, and it is the only place in
 * the repo where the client's drawn tower and the server's score are compared.
 */

const SETTLED_STACK_URL = /\/result\/stack\/[\w-]+(\?name=[^&]*)?$/;

/** Stack's only control. */
const dropButton = (page: Page) => page.getByRole("button", { name: /Drop the sliding block/i });

/**
 * How far apart the block's and the tower top's centres are, in px — or null
 * once either has gone from the page.
 *
 * THE NULL IS THE WHOLE POINT, and getting it needs an explicit timeout.
 * `boundingBox()` WAITS for its element and throws `TimeoutError` when it never
 * arrives; it does not return null for a detached one, which is what the aim loop
 * below was written as though it did. The block unmounts the instant the round
 * ends, so that detachment is the ORDINARY way a drop loop finishes — and left on
 * Playwright's default the loop stalled 5s and then threw, which is how this
 * turned into a flake that a retry papered over.
 *
 * 250ms is generous rather than tight: `startStack` asserts both elements are
 * visible before any loop runs, so an attached box resolves immediately and the
 * only thing this wait can be waiting for is an element that is never coming
 * back. Exactly the argument for the `dispatchEvent` timeout in
 * `helpers/round.ts`, which is the same bug one file over — that one was traced
 * and fixed; this one was left, and cost a gate run to find.
 */
async function centreGap(block: Locator, top: Locator): Promise<{ gap: number; width: number } | null> {
  const box = (l: Locator) => l.boundingBox({ timeout: 250 }).catch(() => null);
  const [b, t] = await Promise.all([box(block), box(top)]);
  if (!b || !t) return null;
  return { gap: Math.abs(b.x + b.width / 2 - (t.x + t.width / 2)), width: t.width };
}

/**
 * Watches the sliding block and taps when `aimed` says its rendered position is
 * where the caller wants it — comparing RENDERED positions rather than reading
 * the game's internal state.
 *
 * It aims rather than waiting a fixed time because the sweep speeds up with
 * every placed block — a hard-coded delay would drift out of phase after two or
 * three drops and turn this into a test of nothing. Alignment is only ever
 * approximate: a few milliseconds pass between measuring and dispatching, and
 * at the block's speed that is a pixel or two of drift. That is the point —
 * the tower trims a little on each drop, exactly as a human player's would.
 *
 * One loop with a predicate rather than two near-identical copies: the timeout
 * discipline above is subtle enough that having it written down twice is how one
 * copy gets fixed and the other does not.
 */
async function dropWhen(
  page: Page,
  aimed: (gap: number, towerWidth: number) => boolean,
): Promise<boolean> {
  const block = page.getByTestId("stack-block");
  const top = page.getByTestId("stack-tower-top");

  for (let i = 0; i < 240; i++) {
    const measured = await centreGap(block, top);
    if (!measured) return false;
    if (aimed(measured.gap, measured.width)) {
      // Bounded and caught for the same reason as centreGap: the round can end
      // between the measurement above and this dispatch. Stack's button is
      // DISABLED rather than unmounted at that point (`disabled={ending !== null}`
      // in Stack.tsx) so the dispatch normally still resolves and `handleDrop`
      // ignores it — unlike Tap Fast's, which really is removed. The guard is
      // cheap insurance against that difference changing, not a load-bearing
      // catch: what it must not do is wait out the TEST timeout, which is what
      // the explicit 1s is for.
      await dropButton(page)
        .dispatchEvent("pointerdown", {}, { timeout: 1_000 })
        .catch(() => {
          /* the round ended under us; the drop is moot either way */
        });
      return true;
    }
    await page.waitForTimeout(8);
  }
  return false;
}

/** Taps when the sliding block is over the tower. */
const dropOnTarget = (page: Page) => dropWhen(page, (gap) => gap <= 3);

/**
 * Taps when the block is far enough from the tower that it CANNOT overlap it.
 *
 * The inverse of dropOnTarget, and deterministic for the same reason: both are
 * the tower's own width, so they overlap exactly when their centres are less
 * than that width apart. Waiting for a clear gap makes the miss a fact rather
 * than a hope — "tap as soon as the round starts" is not, because how long the
 * harness takes to get there decides where in the sweep the block happens to be.
 */
const dropOffTarget = (page: Page) => dropWhen(page, (gap, width) => gap > width * 1.1);

/** Opens a Stack round and waits for the block to be in play. */
async function startStack(page: Page, playerName: string): Promise<void> {
  await page.goto("/");
  await ui.nameField(page).fill(playerName);
  await ui.gameCard(page, "Stack").click();
  await expect(dropButton(page)).toBeVisible();
  await expect(page.getByTestId("stack-block")).toBeVisible();
}

test.describe("stack", () => {
  test("the score on the result screen is the one the server computed from the drops", async ({
    page,
  }) => {
    await startStack(page, "Stacker");

    // Four aimed drops. A drop that MISSES ends the round outright — sudden death
    // is the rule — so the loop stops as soon as the block stops being there.
    for (let i = 0; i < 4; i++) {
      if (!(await dropOnTarget(page))) break;
    }

    // A commit's worth of slack before reading the DOM: dropOnTarget returns the
    // instant it dispatches, so without this the attribute below can still hold
    // the value from before the last drop.
    await page.waitForTimeout(50);

    // The count the CLIENT stacked, read from the game rather than tallied here.
    // The client never SENDS this number — it is read purely so it can be held
    // against what the server independently worked out.
    //
    // Counting successful dropOnTarget calls instead was a flake in this harness,
    // and not a subtle one once seen: an aimed tap is only APPROXIMATELY aligned
    // (a few ms pass between measuring and dispatching, which is a pixel or two of
    // drift at the block's speed), so a drop this file considered good can still
    // shave the edge and miss. That tally counted intent; `data-stacked` counts
    // outcome — it is `dropsRef.current.length`, the drops that actually landed,
    // since a missed block is drawn where it fell but never pushed (see `reported`
    // in Stack.tsx). The two disagreeing meant the harness was wrong, and the
    // retry that hid it was reporting a green gate for a test that failed 4 runs
    // in 5 once the stall below stopped masking the frequency.
    const drawn = Number(await dropButton(page).getAttribute("data-stacked"));
    expect(drawn).toBeGreaterThan(0);

    // End the round rather than waiting out the 15s clock, and end it the same
    // DETERMINISTIC way the sibling test does: dropOffTarget waits for a gap wider
    // than the tower before tapping, so the miss is a fact. Sudden death is worth
    // exercising here either way.
    //
    // Tapping immediately instead — on the reasoning that a fresh block enters
    // from the edge opposite the last one, so it must be far from the tower — was
    // a hope dressed as a certainty. It holds while the tower sits near the
    // centre, and stops holding as the tower narrows and DRIFTS toward that same
    // edge, at which point the immediate drop lands and the round runs to the
    // whistle instead.
    //
    // Whether the round is STILL LIVE is a question for the DOM, not for the loop
    // above: an aimed tap that shaved the edge and missed has already ended it
    // while dropOnTarget still reports that it dispatched — the same
    // intent-versus-outcome trap as the drop count, one layer up. Stack disables
    // its button at that point (`disabled={ending !== null}`), so the button IS the
    // answer. The result of the attempt is deliberately not asserted: if the round
    // ends underneath it, `false` is correct and the assertions below still hold.
    if (await dropButton(page).isEnabled()) {
      await dropOffTarget(page);
    }

    // Generous, because the 15s round clock is the backstop if neither the aimed
    // drops nor the deliberate miss ended the round. Reaching the result that way
    // is slow but not wrong, and a timeout shorter than the clock would report it
    // as a failure of the score comparison below rather than as what it is.
    await expect(page).toHaveURL(SETTLED_STACK_URL, { timeout: 20_000 });
    await expect(ui.playAgain(page)).toBeVisible();

    // THE assertion. The number came back over HTTP from a replay of the drop
    // timings in Go; `drawn` came from the TypeScript simulation that painted
    // the tower. A divergence between the two languages' integer arithmetic
    // surfaces here as a player being told they missed a block that landed.
    const shown = Number((await page.locator(".tabular-nums").first().innerText()).trim());
    expect(shown).toBe(drawn);
  });

  test("a missed first block ends the round at zero rather than failing the submission", async ({
    page,
  }) => {
    await startStack(page, "Hasty");

    // Nothing was stacked, which is an ordinary outcome and not an error: the
    // round must still submit, still reach a result URL, and still show a
    // score — zero. This is the client's half of the rule the Go scorer states
    // as "a MISS is not an error"; a submission with no events at all is the
    // same case and is covered by the service tests.
    expect(await dropOffTarget(page)).toBe(true);

    await expect(page).toHaveURL(SETTLED_STACK_URL);
    await expect(ui.playAgain(page)).toBeVisible();

    const shown = Number((await page.locator(".tabular-nums").first().innerText()).trim());
    expect(shown).toBe(0);
  });
});
