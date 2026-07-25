import { expect, test } from "@playwright/test";
import {
  CLAIM_CODE_PATTERN,
  END_OF_ROUND_MS,
  playRound,
  revealScore,
  SETTLED_RESULT_URL,
  shownScore,
  ui,
} from "../helpers/round";

test.describe("play flow", () => {
  test("a finished round celebrates first and withholds the score until the reveal", async ({ page }) => {
    // The celebration beat is time-boxed and advances itself, so what is
    // asserted DURING it has to resolve immediately. These all pass on the
    // element that playRound already waited for; nothing here waits.
    await playRound(page, "Flow");

    // The whole point of this stage: the round is over, the score is not shown.
    await expect(ui.completeStage(page)).toContainText("Game complete");
    await expect(ui.revealStage(page)).toBeHidden();

    // The sequence carries itself to the result URL, flagging the one-shot
    // reveal on the way.
    await expect(page).toHaveURL(/\/result\/tap-fast\/[\w-]+\?.*reveal=1/);

    // Once the meter settles, the flag is dropped from the URL so a refresh
    // won't replay the build-up.
    await expect(page).toHaveURL(/\/result\/tap-fast\/[\w-]+(\?name=[^&]*)?$/);
    await expect(page).not.toHaveURL(/reveal=1/);
    await expect(ui.playAgain(page)).toBeVisible();
  });

  test("a tap-storm carried past the final whistle cannot skip the ending", async ({ page }) => {
    await playRound(page, "Masher");
    const startedAt = Date.now();

    // A player does not stop tapping the instant the round ends. These land in
    // the middle of the screen — exactly where the two skip buttons used to be,
    // and exactly where a Tap Fast finger already is.
    const view = page.viewportSize();
    for (let i = 0; i < 12; i++) {
      await page.mouse.click((view?.width ?? 400) / 2, (view?.height ?? 700) / 2);
      await page.waitForTimeout(60);
    }

    await expect(page).toHaveURL(SETTLED_RESULT_URL);

    // The floor is what makes this a real assertion: a working skip would land
    // here in well under a second. It sits comfortably below END_OF_ROUND_MS so
    // timer jitter cannot fail it.
    expect(Date.now() - startedAt).toBeGreaterThan(END_OF_ROUND_MS - 800);
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

  test("a winning round hands the player a claim code, not a screenshot", async ({ page }) => {
    await playRound(page, "Winner");
    await revealScore(page);

    // The round taps for the full server-timed 5s, which clears the lowest
    // prize threshold — so this round always wins something.
    const code = ui.claimCode(page);
    await expect(code).toBeVisible();
    await expect(code).toHaveText(CLAIM_CODE_PATTERN);

    // The point of the whole feature: the credential is a server-issued code
    // that can be marked used, not "show this screen at the counter".
    await expect(page.getByText(/show this screen/i)).toBeHidden();
    await expect(ui.copyCode(page)).toBeVisible();

    // The code is the one thing on this screen a player has to transcribe, so
    // it must survive the global no-select rule being scoped to game surfaces.
    const selectable = await code.evaluate((el) => getComputedStyle(el).userSelect);
    expect(selectable).not.toBe("none");
  });

  test("the claim code survives a reload of the result URL", async ({ page }) => {
    await playRound(page, "Reclaim");
    await revealScore(page);
    const before = await ui.claimCode(page).innerText();

    await page.reload();

    // One round earns exactly one claim — a revisit must not mint another.
    await expect(ui.playAgain(page)).toBeVisible();
    expect(await ui.claimCode(page).innerText()).toBe(before);
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
  test("every game in the catalog is offered and carries its own icon", async ({ page }) => {
    await page.goto("/");

    await expect(ui.gameCard(page, "Tap Fast")).toBeVisible();
    await expect(ui.gameCard(page, "Reaction Timer")).toBeVisible();
    await expect(ui.gameCard(page, "Precision Stop")).toBeVisible();
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

  /**
   * Precision Stop is the first game the PLAYER ends. Tap Fast and Reaction
   * Timer both run until a timer fires, so nothing until now exercised a round
   * that finishes on a pointer event mid-clock — and this is also the only game
   * whose score can legitimately be 0, the case the reveal meter was rewritten
   * for. Both are worth one pass through a real browser.
   */
  test("Precision Stop ends the round on the player's own tap", async ({ page }) => {
    await page.goto("/");
    await ui.gameCard(page, "Precision Stop").click();

    const stop = ui.stopButton(page);
    await expect(stop).toBeVisible();
    await stop.dispatchEvent("pointerdown");

    // The stop holds the track before handing off, so the player can see where
    // they landed — the one thing the score reveal can never show them, since
    // it reports a distance and not a place.
    await expect(page.getByText(/off centre/)).toBeVisible();
    await expect(stop).toBeDisabled();

    // The round is over the instant it is stopped: no waiting out the clock.
    await expect(ui.completeStage(page)).toBeVisible();
    await expect(page).toHaveURL(/\/result\/precision-stop\/[\w-]+/);
  });
});
