import { expect, type Locator, type Page } from "@playwright/test";
import { endOfRoundMs } from "../../frontend/packages/player-core/src/reveal/pacing";

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
  /**
   * The store's cover banner, addressed by the URL the settings told it to show.
   *
   * By `src` rather than by role or name, and that is the assertion rather than
   * a shortcut: the banner is decoration (`alt=""`, see StoreBanner) precisely
   * because the store is already named in the header below it, so it has no
   * accessible name to look it up by — and the URL is the thing that had to
   * survive the trip from the admin's form to this element anyway.
   */
  banner: (page: Page, url: string) => page.locator(`img[src="${url}"]`),
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
    // The timeout is load-bearing, not defensive. There is a window of a few ms
    // between the check above and this dispatch resolving its element, and if
    // the round ends inside it the "TAP!" button is unmounted for good — so
    // this dispatch is waiting for something that is never coming back. Left
    // unbounded (Playwright's default) it waits for the TEST timeout, turning
    // an 11.6s test into a 60s one; worse, the catch below then swallows the
    // real error and the failure surfaces on the NEXT call instead. One flake
    // was traced to exactly that. actionTimeout in playwright.config.ts is the
    // belt to this pair of braces.
    await tap.dispatchEvent("pointerdown", {}, { timeout: 1_000 }).catch(() => {
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
 * The full unskippable stretch between the last tap and the settled result,
 * taken from the app's own pacing rather than restated.
 *
 * This used to be the literal 3800, with a comment explaining that the e2e
 * package sits outside the frontend workspace and therefore could not import
 * COMPLETE_BEAT_MS + REVEAL_DURATION_MS. The workspace is not the obstacle it
 * was made out to be: `import` takes a path, and a relative one crosses a
 * package boundary that only npm's linking cares about. Playwright transpiles
 * the imported .ts the same way it transpiles this file.
 *
 * What makes it SAFE to reach across is the package rule itself — pacing.ts
 * lives in `packages/`, so it may not import React, touch `window`, or reach the
 * network (see frontend/CLAUDE.md). Pure data and pure functions are importable
 * from anywhere, including a Node-side test runner. Nothing under `apps/` could
 * be borrowed this way, and nothing here should try.
 *
 * `endOfRoundMs` rather than re-adding the two beats: the sum is a calculation
 * the app already owns, and a second `+` here would be a smaller copy of the
 * same mistake. `false` because the suite does not emulate reduced motion — the
 * one input allowed to collapse the beats to zero.
 */
export const END_OF_ROUND_MS = endOfRoundMs(false);

/** Reads the big score number off the settled result screen. */
export async function shownScore(page: Page): Promise<number> {
  const text = await scoreValue(page).innerText();
  return Number(text.trim());
}

function scoreValue(page: Page): Locator {
  return page.locator(".tabular-nums").first();
}
