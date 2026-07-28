import { expect, test } from "@playwright/test";
import { horizontalOverflow, NARROW_VIEWPORT } from "../helpers/layout";
import { ui } from "../helpers/round";

/**
 * Thai support, in a real browser.
 *
 * This is the only place the two halves of the feature are exercised together.
 * Half the words on a screen come from the client's own dictionary
 * (packages/player-core/src/i18n) and half are served by the backend with the
 * game (backend/internal/i18n) — and each half has its own unit tests that pass
 * perfectly well while the wire between them is disconnected. A screen showing
 * "เล่นเลย ลุ้นรางวัล" above a game called "Tap Fast" is the failure these
 * tests exist to catch, and nothing below the browser can see it.
 */

/** The landing headline, client-owned. */
const THAI_HEADLINE = "เล่นเลย ลุ้นรางวัล";

/** Tap Fast's name, served by the API from its catalog. */
const THAI_GAME = "แตะให้ไว";

test.describe("Thai", () => {
  test("?lang=th translates both the app's own copy and the API's", async ({ page }) => {
    await page.goto("/?lang=th");

    await expect(page.getByText(THAI_HEADLINE)).toBeVisible();
    // The game name arrives over HTTP, so this is the assertion that proves the
    // client asked for Thai rather than merely rendering in it.
    await expect(ui.gameCard(page, THAI_GAME)).toBeVisible();
    await expect(page.getByText("ของรางวัลวันนี้")).toBeVisible();
  });

  // Not decoration: it is what tells a screen reader which voice to use, and
  // what lets the browser break Thai lines on dictionary boundaries — Thai has
  // no spaces between words, so the wrong value wraps mid-word.
  test("sets the document language", async ({ page }) => {
    await page.goto("/?lang=th");
    await expect(page.locator("html")).toHaveAttribute("lang", "th");

    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("a bare URL is unpinned and follows the browser", async ({ page }) => {
    await page.goto("/");

    // This browser reports English, so an unpinned app is English — and stays
    // out of the URL, per the rule that a default is never written.
    await expect(ui.gameCard(page, "Tap Fast")).toBeVisible();
    await expect(page).not.toHaveURL(/lang=/);
  });

  test("the switcher pins the choice in the URL", async ({ page }) => {
    await page.goto("/");

    // Every option names itself, which is the one rule a language switcher
    // cannot break: someone looking for Thai scans for "ไทย".
    await page.getByRole("button", { name: "ไทย" }).click();

    await expect(page).toHaveURL(/lang=th/);
    await expect(page.getByText(THAI_HEADLINE)).toBeVisible();
    await expect(ui.gameCard(page, THAI_GAME)).toBeVisible();

    // And back again, without a reload.
    await page.getByRole("button", { name: "EN" }).click();
    await expect(page).toHaveURL(/lang=en/);
    await expect(ui.gameCard(page, "Tap Fast")).toBeVisible();
  });

  // A pin that fell off on the first navigation would be no pin at all: the
  // kiosk would revert to the phone's language the moment someone picked a game.
  test("the pin travels with the player into a round", async ({ page }) => {
    await page.goto("/?lang=th&name=ผู้เล่น");

    await ui.gameCard(page, THAI_GAME).click();
    await expect(page).toHaveURL(/\/play\/tap-fast\?.*lang=th/);

    // The quit control is client copy and the stage title is the API's, so this
    // one screen proves both halves survived the navigation.
    await expect(page.getByRole("button", { name: "ออก" })).toBeVisible();
    // By heading rather than by text: the countdown echoes the same name as its
    // eyebrow, so a loose match resolves to two elements.
    await expect(page.getByRole("heading", { name: THAI_GAME })).toBeVisible();
  });
});

/**
 * Thai on the narrowest screen the project supports.
 *
 * Its own describe block because `test.use` sets the viewport for a whole
 * block, and every other spec wants the default Pixel 7 width (412px) — which
 * is wide enough that none of them would notice this class of failure.
 *
 * Thai is where it bites first. There are no spaces between words, so `truncate`
 * cuts mid-word rather than shortening, and the dictionary keeps strings that
 * land in a fixed slot short ON PURPOSE (see the header comment in th.ts). That
 * is a convention with nothing enforcing it, and this is the check that turns it
 * into one — including for the strings nobody reviewed, since a store name is
 * admin free text translated nowhere.
 */
test.describe("Thai at 320px", () => {
  test.use({ viewport: NARROW_VIEWPORT });

  test("the landing screen fits the narrowest supported screen", async ({ page }) => {
    await page.goto("/?lang=th");
    await expect(ui.gameCard(page, THAI_GAME)).toBeVisible();

    const { documentPx, worst } = await horizontalOverflow(page);
    expect(documentPx, `document scrolls ${documentPx}px sideways; widest: ${worst}`).toBe(0);
    expect(worst, "an element extends past the right edge").toBe("");
  });

  test("a round in progress fits it too", async ({ page }) => {
    // The play screen rather than the result screen, deliberately: it is
    // reachable without spending a round's unskippable ending, and it carries
    // the two longest fixed-slot strings in the app — the game's own name from
    // the API beside the client's quit control.
    await page.goto("/?lang=th");
    await ui.gameCard(page, THAI_GAME).click();
    await expect(page.getByRole("button", { name: "ออก" })).toBeVisible();

    const { documentPx, worst } = await horizontalOverflow(page);
    expect(documentPx, `document scrolls ${documentPx}px sideways; widest: ${worst}`).toBe(0);
    expect(worst, "an element extends past the right edge").toBe("");
  });
});
