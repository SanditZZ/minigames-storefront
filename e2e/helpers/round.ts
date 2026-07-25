import { expect, type Locator, type Page } from "@playwright/test";

/** Named locators for the player flow, so a markup change is fixed in one file. */
export const ui = {
  nameField: (page: Page) => page.getByLabel("Your name (optional)"),
  gameCard: (page: Page, game = "Tap Fast") => page.getByRole("button", { name: new RegExp(game) }),
  tapButton: (page: Page) => page.getByRole("button", { name: "TAP!" }),
  // Both end-of-round stages are plain regions, not buttons. That is the
  // feature: neither can be tapped through. See pacing.ts in player-core.
  completeStage: (page: Page) => page.getByRole("region", { name: /Game complete/i }),
  revealStage: (page: Page) => page.getByRole("region", { name: /Revealing your score/i }),
  playAgain: (page: Page) => page.getByRole("button", { name: "Play again" }),
  /** The claim code on a winning result, in its grouped display form. */
  claimCode: (page: Page) => page.getByText(CLAIM_CODE_PATTERN),
  copyCode: (page: Page) => page.getByRole("button", { name: /Copy the claim code/i }),
  quit: (page: Page) => page.getByRole("button", { name: "Quit" }),
  confirmQuit: (page: Page) => page.getByRole("button", { name: "Confirm quitting this round" }),
  /** Reaction Timer's pre-flip state. */
  waitButton: (page: Page) => page.getByRole("button", { name: /Wait for the signal/i }),
  /** Precision Stop's only control. */
  stopButton: (page: Page) => page.getByRole("button", { name: /Stop the marker/i }),
};

/**
 * A claim code as the player sees it: two groups of four, from the backend's
 * confusable-free alphabet (no O/0, no I/L/1) — see internal/id.
 */
export const CLAIM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

/** Matches a settled result URL — the reveal flag must be gone by then. */
export const SETTLED_RESULT_URL = /\/result\/tap-fast\/[\w-]+(\?name=[^&]*)?$/;

/**
 * Plays one full round of Tap Fast and stops on the "Game complete" stage,
 * without continuing to the score.
 *
 * The tap loop paces simulated input; it does not stand in for waiting on
 * application state. Every state transition below is asserted with a web-first
 * expectation, so the test is not timing-dependent.
 */
export async function playRound(page: Page, playerName = "E2E"): Promise<void> {
  await page.goto("/");

  await ui.nameField(page).fill(playerName);
  await ui.gameCard(page).click();

  const tap = ui.tapButton(page);
  await expect(tap).toBeVisible();

  const complete = ui.completeStage(page);
  // The round is server-timed (5s by default). Tap until it ends, with a cap so
  // a broken timer fails the test rather than looping forever.
  for (let i = 0; i < 80; i++) {
    if (await complete.isVisible()) break;
    await tap.dispatchEvent("pointerdown").catch(() => {
      /* the button unmounts the moment the round ends */
    });
    await page.waitForTimeout(120);
  }

  await expect(complete).toBeVisible();
}

/**
 * Waits out the celebration and the reveal to reach the settled result.
 *
 * There is nothing to click: the sequence advances itself and cannot be cut
 * short, so this only waits. The settled URL is the honest signal that both
 * beats finished — the reveal drops the ?reveal flag as it lands.
 */
export async function revealScore(page: Page): Promise<void> {
  await expect(page).toHaveURL(SETTLED_RESULT_URL);
  await expect(ui.playAgain(page)).toBeVisible();
}

/**
 * The full unskippable stretch, mirrored from COMPLETE_BEAT_MS +
 * REVEAL_DURATION_MS in @minigames/player-core (1600 + 2200). The e2e package
 * sits outside the frontend workspace on purpose, so it cannot import them;
 * a test asserts a floor comfortably below this rather than the exact value.
 */
export const END_OF_ROUND_MS = 3800;

/** Reads the big score number off the settled result screen. */
export async function shownScore(page: Page): Promise<number> {
  const text = await scoreValue(page).innerText();
  return Number(text.trim());
}

function scoreValue(page: Page): Locator {
  return page.locator(".tabular-nums").first();
}
