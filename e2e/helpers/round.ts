import { expect, type Locator, type Page } from "@playwright/test";

/** Named locators for the player flow, so a markup change is fixed in one file. */
export const ui = {
  nameField: (page: Page) => page.getByLabel("Your name (optional)"),
  gameCard: (page: Page, game = "Tap Fast") => page.getByRole("button", { name: new RegExp(game) }),
  tapButton: (page: Page) => page.getByRole("button", { name: "TAP!" }),
  completeStage: (page: Page) => page.getByRole("button", { name: /Game complete/i }),
  revealStage: (page: Page) => page.getByRole("button", { name: /Revealing your score/i }),
  playAgain: (page: Page) => page.getByRole("button", { name: "Play again" }),
  skipHint: (page: Page) => page.getByText("Tap to skip"),
};

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

/** Continues from the celebration through the reveal to the settled result. */
export async function revealScore(page: Page): Promise<void> {
  await ui.completeStage(page).click();
  await expect(page).toHaveURL(SETTLED_RESULT_URL);
  await expect(ui.playAgain(page)).toBeVisible();
}

/** Reads the big score number off the settled result screen. */
export async function shownScore(page: Page): Promise<number> {
  const text = await scoreValue(page).innerText();
  return Number(text.trim());
}

function scoreValue(page: Page): Locator {
  return page.locator(".tabular-nums").first();
}
