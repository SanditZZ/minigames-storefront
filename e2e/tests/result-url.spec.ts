import { expect, test } from "@playwright/test";
import { playRound, revealScore, shownScore, ui } from "../helpers/round";

test.describe("result URL", () => {
  test("survives a reload and skips the reveal the second time", async ({ page }) => {
    await playRound(page, "Reload");
    await revealScore(page);

    const url = page.url();
    const score = await shownScore(page);

    await page.reload();

    await expect(ui.playAgain(page)).toBeVisible();
    expect(await shownScore(page)).toBe(score);
    expect(page.url()).toBe(url);
    // Someone who already knows their score must not sit through it again —
    // which matters more now the reveal cannot be skipped. The settled URL
    // carries no ?reveal flag, so the reload renders the result directly.
    await expect(ui.revealStage(page)).toBeHidden();
  });

  test("is genuinely addressable — a fresh browser context renders the same result", async ({ page, browser }) => {
    await playRound(page, "Shared");
    await revealScore(page);

    const url = page.url();
    const score = await shownScore(page);

    // A new context has no in-memory hand-off and no storage from the round,
    // so this only works if the result is served by the backend.
    const context = await browser.newContext();
    const shared = await context.newPage();
    await shared.goto(url);

    await expect(ui.playAgain(shared)).toBeVisible();
    expect(await shownScore(shared)).toBe(score);
    await expect(shared.getByText("Shared").first()).toBeVisible();
    // And the storefront it came from. This is the assertion the identity lift
    // exists for: the settings are fetched once at the top of the app rather
    // than by the landing screen, so a result URL opened cold — no hand-off, no
    // storage, never having seen the picker — still credits the store.
    //
    // What this pins is that the mark RENDERS here, and no more: the seeded
    // store_name (app.seed) and the client's fallback (brand.name) spell "Fun
    // Store" identically, so a provider that never fetched would pass this too.
    // The fetch itself is pinned next door — admin-branding.spec.ts renames the
    // store and watches the new name reach the player. Two cheap assertions in
    // the places that already do the work, rather than one expensive spec that
    // renames a store and then plays a round to see it.
    await expect(shared.getByText("Fun Store")).toBeVisible();

    await context.close();
  });

  test("Back from a result goes to the picker, not back into the finished round", async ({ page }) => {
    await playRound(page, "History");
    await revealScore(page);

    await page.goBack();

    await expect(page).toHaveURL(/\/(\?.*)?$/);
    await expect(ui.gameCard(page)).toBeVisible();
    // Specifically NOT the play screen — replaying a finished round on Back
    // would be both confusing and a free extra attempt.
    await expect(ui.tapButton(page)).toBeHidden();
  });

  test("Play again starts a new round rather than reopening the old result", async ({ page }) => {
    await playRound(page, "Again");
    await revealScore(page);

    await ui.playAgain(page).click();

    await expect(page).toHaveURL(/\/play\/tap-fast/);
    await expect(ui.tapButton(page)).toBeVisible();
  });
});
