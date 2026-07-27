import { expect, test, type Page } from "@playwright/test";
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
 * Taps when the sliding block is over the tower, by comparing their RENDERED
 * positions rather than reading the game's internal state.
 *
 * It aims rather than waiting a fixed time because the sweep speeds up with
 * every placed block — a hard-coded delay would drift out of phase after two or
 * three drops and turn this into a test of nothing. Alignment is only ever
 * approximate: a few milliseconds pass between measuring and dispatching, and
 * at the block's speed that is a pixel or two of drift. That is the point —
 * the tower trims a little on each drop, exactly as a human player's would.
 */
async function dropOnTarget(page: Page): Promise<boolean> {
  const block = page.getByTestId("stack-block");
  const top = page.getByTestId("stack-tower-top");

  for (let i = 0; i < 240; i++) {
    const [b, t] = await Promise.all([block.boundingBox(), top.boundingBox()]);
    // The block is unmounted the instant the round ends, which is the ordinary
    // way this loop finishes rather than an error.
    if (!b || !t) return false;
    if (Math.abs(b.x + b.width / 2 - (t.x + t.width / 2)) <= 3) {
      await dropButton(page)
        .dispatchEvent("pointerdown", {}, { timeout: 1_000 })
        .catch(() => {
          /* the button unmounts the moment the round ends */
        });
      return true;
    }
    await page.waitForTimeout(8);
  }
  return false;
}

/**
 * Taps when the block is far enough from the tower that it CANNOT overlap it.
 *
 * The inverse of dropOnTarget, and deterministic for the same reason: both are
 * the tower's own width, so they overlap exactly when their centres are less
 * than that width apart. Waiting for a clear gap makes the miss a fact rather
 * than a hope — "tap as soon as the round starts" is not, because how long the
 * harness takes to get there decides where in the sweep the block happens to be.
 */
async function dropOffTarget(page: Page): Promise<boolean> {
  const block = page.getByTestId("stack-block");
  const top = page.getByTestId("stack-tower-top");

  for (let i = 0; i < 240; i++) {
    const [b, t] = await Promise.all([block.boundingBox(), top.boundingBox()]);
    if (!b || !t) return false;
    const gap = Math.abs(b.x + b.width / 2 - (t.x + t.width / 2));
    if (gap > t.width * 1.1) {
      await dropButton(page)
        .dispatchEvent("pointerdown", {}, { timeout: 1_000 })
        .catch(() => {
          /* the button unmounts the moment the round ends */
        });
      return true;
    }
    await page.waitForTimeout(8);
  }
  return false;
}

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

    // Four aimed drops, then the count the client believes it achieved. The
    // client never SENDS this number — it is read here purely so it can be held
    // against what the server independently worked out.
    let landed = 0;
    for (let i = 0; i < 4; i++) {
      if (!(await dropOnTarget(page))) break;
      landed++;
    }
    expect(landed).toBeGreaterThan(0);

    const drawn = Number(await dropButton(page).getAttribute("data-stacked"));
    expect(drawn).toBe(landed);

    // End the round rather than waiting out a 15s clock: a fresh block enters
    // from the edge opposite the last one, so tapping immediately drops it
    // nowhere near the tower. That miss is also worth exercising — sudden death
    // is the rule that makes the game tense.
    await page.waitForTimeout(40);
    await dropButton(page).dispatchEvent("pointerdown");

    await expect(page).toHaveURL(SETTLED_STACK_URL);
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
