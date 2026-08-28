import { expect, test } from "@playwright/test";
import { playRound, revealScore, ui } from "../helpers/round";

/**
 * The TV/kiosk display route (issue #6) — an ambient leaderboard meant to run
 * unattended, so what matters here is exactly what does NOT need clicking: no
 * name field, no game picker, just the board for whichever slug the URL names.
 *
 * The poll loop itself (`DisplayScreen`'s `setInterval`) is not re-verified
 * here — it calls the same `highScores` fetch `ResultScreen`'s leaderboard
 * already exercises, and waiting out a real 5s tick would slow the suite for a
 * fetch path this already covers.
 */
test.describe("the TV/kiosk display", () => {
  test("shows the named game's board, unprompted", async ({ page }) => {
    await playRound(page, "Display Test");
    await revealScore(page);

    await page.goto("/display/tap-fast");

    await expect(page.getByRole("heading", { name: "Tap Fast", level: 1 })).toBeVisible();
    await expect(page.getByText("Display Test")).toBeVisible();

    // No interaction surface at all — the whole point of a screen nobody is
    // meant to touch.
    await expect(ui.nameField(page)).toHaveCount(0);
    await expect(page.getByRole("button")).toHaveCount(0);
  });

  test("says so plainly for a game that doesn't exist", async ({ page }) => {
    await page.goto("/display/not-a-real-game");
    await expect(page.getByText("This game isn't available.")).toBeVisible();
  });
});
