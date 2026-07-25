import { expect, test } from "@playwright/test";
import { ui } from "../helpers/round";

test.describe("dead ends", () => {
  test("an unknown score id shows a styled result-not-found state", async ({ page }) => {
    await page.goto("/result/tap-fast/does-not-exist");

    await expect(page.getByText("Result not found")).toBeVisible();
    await expect(page.getByRole("button", { name: "Play a game" })).toBeVisible();
  });

  test("an unknown game slug does not strand the player", async ({ page }) => {
    await page.goto("/play/no-such-game");

    await expect(page.getByText("Game not found")).toBeVisible();
    await expect(page.getByRole("button", { name: "See all games" })).toBeVisible();
  });

  test("an unrecognised path shows the not-found screen and can get home", async ({ page }) => {
    await page.goto("/nonsense/path");

    await expect(page.getByText("Page not found")).toBeVisible();
    await page.getByRole("button", { name: "Play a game" }).click();

    await expect(page).toHaveURL(/\/(\?.*)?$/);
    await expect(ui.gameCard(page)).toBeVisible();
  });

  test("a hand-edited URL cannot smuggle a path into an API call", async ({ page }) => {
    // The router validates segments before they reach the typed client.
    await page.goto("/result/tap-fast/..%2F..%2Fadmin%2Fawards");

    await expect(page.getByText("Page not found")).toBeVisible();
  });
});
