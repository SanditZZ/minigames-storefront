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

  test("quitting a live round takes two presses, then returns to the picker", async ({ page }) => {
    await page.goto("/");
    await ui.gameCard(page).click();
    // The tap button only appears once the countdown has handed over, so its
    // presence is what tells us the round is genuinely live.
    await expect(ui.tapButton(page)).toBeVisible();

    // Quit sits a stray thumb away from a rapid-tap target, so one press must
    // not throw the round away — it arms a confirmation instead.
    await ui.quit(page).click();
    await expect(ui.confirmQuit(page)).toBeVisible();
    await expect(ui.tapButton(page)).toBeVisible();
    await expect(page).toHaveURL(/\/play\/tap-fast/);

    await ui.confirmQuit(page).click();
    await expect(page).toHaveURL(/\/(\?.*)?$/);
    await expect(ui.gameCard(page)).toBeVisible();
  });
});

test.describe("game catalog", () => {
  test("both games are offered and each carries its own icon", async ({ page }) => {
    await page.goto("/");

    await expect(ui.gameCard(page, "Tap Fast")).toBeVisible();
    await expect(ui.gameCard(page, "Reaction Timer")).toBeVisible();
  });

  test("the landing screen advertises prizes before a game is chosen", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Today's prizes")).toBeVisible();
    // Seeded starter awards. `exact` matters: the prize blurb also contains the
    // words "free coffee", so a loose match resolves to two elements.
    await expect(page.getByText("Free Coffee", { exact: true })).toBeVisible();
    // Both games seed the same three prizes, so the merge must show three
    // rather than six.
    await expect(page.getByRole("listitem")).toHaveCount(3);
  });

  test("Reaction Timer counts in, then withholds the signal until it flips", async ({ page }) => {
    await page.goto("/");
    await ui.gameCard(page, "Reaction Timer").click();

    // The shared countdown runs first, then the game mounts already counted in.
    await expect(ui.waitButton(page)).toBeVisible();
    // Tapping early is a false start: it must not end the round.
    await ui.waitButton(page).dispatchEvent("pointerdown");
    await expect(page.getByText("Too soon!")).toBeVisible();
    await expect(page).toHaveURL(/\/play\/reaction-timer/);
  });
});
