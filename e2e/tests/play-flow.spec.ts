import { expect, test } from "@playwright/test";
import { playRound, revealScore, shownScore, ui } from "../helpers/round";

test.describe("play flow", () => {
  test("a finished round celebrates first and withholds the score until the reveal", async ({ page }) => {
    await playRound(page, "Flow");

    // The whole point of this stage: the round is over, the score is not shown.
    await expect(ui.completeStage(page)).toContainText("Game complete");
    await expect(ui.playAgain(page)).toBeHidden();
    await expect(ui.revealStage(page)).toBeHidden();
    // Celebrating does not navigate — the player is still on the play URL.
    await expect(page).toHaveURL(/\/play\/tap-fast/);

    // Continuing moves to the result URL and flags the one-shot reveal.
    await ui.completeStage(page).click();
    await expect(page).toHaveURL(/\/result\/tap-fast\/[\w-]+\?.*reveal=1/);

    // Once the meter settles, the flag is dropped from the URL so a refresh
    // won't replay the build-up.
    await expect(page).toHaveURL(/\/result\/tap-fast\/[\w-]+(\?name=[^&]*)?$/);
    await expect(page).not.toHaveURL(/reveal=1/);
    await expect(ui.playAgain(page)).toBeVisible();
  });

  test("the revealed score is a real number and the player is named on the board", async ({ page }) => {
    await playRound(page, "Scorer");
    await revealScore(page);

    expect(await shownScore(page)).toBeGreaterThan(0);
    await expect(page.getByText("Scorer").first()).toBeVisible();
    await expect(page.getByText("Top players")).toBeVisible();
  });

  test("the display name travels in the URL and survives the whole flow", async ({ page }) => {
    await playRound(page, "Urlname");
    // Typing the name must not push history entries — it is written in place.
    await expect(page).toHaveURL(/name=Urlname/);

    await revealScore(page);
    await expect(page).toHaveURL(/name=Urlname/);
  });

  test("quitting a round returns to the picker without recording a score", async ({ page }) => {
    await page.goto("/");
    await ui.gameCard(page).click();
    await expect(ui.tapButton(page)).toBeVisible();

    await page.getByRole("button", { name: "Quit" }).click();
    await expect(page).toHaveURL(/\/(\?.*)?$/);
    await expect(ui.gameCard(page)).toBeVisible();
  });
});
