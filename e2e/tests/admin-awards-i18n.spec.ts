import { expect, test, type Page } from "@playwright/test";
import { awards, oneAward, openAdmin, openAwardForm } from "../helpers/admin";
import { playRound, revealScore, ui } from "../helpers/round";

/**
 * A prize named in Thai, from the admin form to the player's screen.
 *
 * This is the seam the whole feature is: the operator types Thai into a form on
 * one origin, and a player on another origin — asking in Thai, over HTTP — has
 * to receive it ready to render. Every part has unit tests on its own side
 * (reward/text_test.go for the pick, sqlite/awards_test.go for the round trip,
 * filter.test.ts for the search) and all of them pass while the two halves are
 * disconnected. Only a browser can see Thai chrome around "Free Coffee".
 *
 * ## Why some tests translate the prize for all three games
 *
 * The landing showcase MERGES prizes by name across games (`mergePrizes` in
 * player-core), and EVERY game seeds a prize called "Free Coffee" — so they all
 * collapse into one row. Translating tap-fast's alone therefore SPLITS that
 * row: "กาแฟฟรี" from tap-fast, "Free Coffee" still from the rest. That is a
 * real consequence of partial translation, filed in
 * docs/potential-features.md, and it is why the storefront-level test here
 * translates every game — which is also what a venue does, since it translates
 * its prize list rather than one game's.
 *
 * It also means GAMES below must track the catalog. A new game adds a fourth
 * "Free Coffee" that no test translates, and the English row reappears.
 *
 * ## The restore is load-bearing
 *
 * These tests edit SEEDED awards that later specs rely on, and this file sorts
 * first. Every test puts them back — same discipline, same reasoning, as
 * admin-branding.spec.ts.
 */

const PRIZE = "Free Coffee";
const PRIZE_TH = "กาแฟฟรี";
const DESC_EN = "Reach 40 taps to earn a free coffee.";
const DESC_TH = "แตะให้ได้ 40 ครั้งเพื่อรับกาแฟฟรี";

/**
 * Every game that seeds a prize by this name — see app.starterAwards.
 *
 * Re-derive this rather than trusting it: EVERY game's ladder seeds a "Free
 * Coffee", so the list grows with the catalog and a game missing from it
 * silently breaks the assertion below that no English copy survives. That is
 * not hypothetical — adding Stack is what caught it.
 */
const GAMES = ["tap-fast", "reaction-timer", "precision-stop", "stack"];

/** tap-fast's full prize ladder, for the test that cannot predict which is won. */
const TAP_PRIZES = [
  { en: "10% Off Coupon", th: "คูปองส่วนลด 10%" },
  { en: PRIZE, th: PRIZE_TH },
  { en: "Store Tote Bag", th: "ถุงผ้าประจำร้าน" },
];

/**
 * A prize NAME on the player's screen, matched exactly.
 *
 * `exact` is required rather than defensive: the English description ends
 * "…a free coffee." and the Thai one ends "…รับกาแฟฟรี", so a substring match on
 * either name also matches its own description and the assertion dies of a
 * strict-mode violation instead of telling you anything.
 */
const prize = (page: Page, name: string) => page.getByText(name, { exact: true });

async function setThaiText(
  page: Page,
  game: string,
  name: string,
  description: string,
  prizeName = PRIZE,
): Promise<void> {
  // The open-and-narrow sequence is shared with admin-forms.spec.ts, so it
  // lives in helpers/admin.ts rather than here.
  await openAwardForm(page, game, prizeName);
  await expect(awards.nameTh(page)).toBeVisible();
  await awards.nameTh(page).fill(name);
  await awards.descriptionTh(page).fill(description);
  await awards.save(page).click();
  // Returning to the list is the app's own signal the write landed.
  await expect(awards.editOnly(page)).toBeVisible();
}

/** Translates (or, with two empty strings, un-translates) every game's copy. */
async function setThaiTextEverywhere(page: Page, name: string, description: string): Promise<void> {
  for (const game of GAMES) await setThaiText(page, game, name, description);
}

test.describe("a prize named in Thai", () => {
  test("reaches a Thai player and leaves an English one alone", async ({ page }) => {
    await setThaiTextEverywhere(page, PRIZE_TH, DESC_TH);

    // The showcase advertises prizes BEFORE anyone plays, so this is the first
    // thing a Thai customer sees — and it was the last thing still in English.
    await page.goto("/?lang=th");
    await expect(prize(page, PRIZE_TH)).toBeVisible();
    await expect(prize(page, DESC_TH)).toBeVisible();
    await expect(prize(page, PRIZE)).toBeHidden();

    // The same prizes, same endpoint, unpinned locale. Translating one language
    // must not touch the other — this is the assertion that fails if the pick
    // ever degrades to "show whatever is filled in".
    await page.goto("/");
    await expect(prize(page, PRIZE)).toBeVisible();
    await expect(prize(page, PRIZE_TH)).toBeHidden();

    await setThaiTextEverywhere(page, "", "");
    await page.goto("/?lang=th");
    await expect(prize(page, PRIZE)).toBeVisible();
  });

  test("falls back per field, not per award", async ({ page }) => {
    // A Thai name and NO Thai description — the half-finished state an operator
    // translating a prize list incrementally is in for most of the afternoon.
    await setThaiTextEverywhere(page, PRIZE_TH, "");

    await page.goto("/?lang=th");
    await expect(prize(page, PRIZE_TH)).toBeVisible();
    // The English description survives beside the Thai name rather than dragging
    // the whole entry back to English. A visibly bilingual card is the honest
    // rendering of a half-finished translation.
    await expect(prize(page, DESC_EN)).toBeVisible();

    await setThaiTextEverywhere(page, "", "");
  });

  test("is findable in the admin by its Thai name", async ({ page }) => {
    await setThaiText(page, "tap-fast", PRIZE_TH, DESC_TH);

    // Staff who named a prize in Thai search for it in Thai. Before the search
    // read both names, the only way to find this row was to know its English
    // name — which is exactly what a Thai-speaking venue does not.
    await openAdmin(page, oneAward("tap-fast", PRIZE_TH));
    await expect(awards.editOnly(page)).toHaveCount(1);

    // And the English name still finds it: translating a prize must not cost the
    // lookup an operator was already using.
    await openAdmin(page, oneAward("tap-fast", PRIZE));
    await expect(awards.editOnly(page)).toHaveCount(1);

    await setThaiText(page, "tap-fast", "", "");
  });

  test("the won prize is named in Thai on the claim too", async ({ page }) => {
    // All three of tap-fast's prizes, because WHICH one a round wins is not
    // fixed: the tap loop paces simulated input, so the score lands somewhere
    // above the lowest threshold and the prize follows it. A test that assumed
    // "Free Coffee" would pass or fail on tap timing rather than on language.
    for (const p of TAP_PRIZES) await setThaiText(page, "tap-fast", p.th, "", p.en);

    await playRound(page, "Winner");
    await revealScore(page);
    await expect(ui.claimCode(page)).toBeVisible();

    // Re-open the SAME finished round in Thai. The result URL is permanent and
    // the locale is a route parameter like any other, so this is one page load
    // rather than a second round — which isolates the language from everything
    // else about the result in a way a fresh Thai round could not.
    const settled = new URL(page.url());
    settled.searchParams.set("lang", "th");
    await page.goto(settled.toString());

    // The result screen reads the CLAIM's snapshot, not the live award, so this
    // covers a different column (claims.award_name_th) and a different code path
    // from the showcase above. Without it the flagship moment — winning — would
    // still be in English for a player who chose Thai.
    for (const p of TAP_PRIZES) await expect(prize(page, p.en)).toBeHidden();
    const shown = await Promise.all(TAP_PRIZES.map((p) => prize(page, p.th).isVisible()));
    expect(shown.filter(Boolean)).toHaveLength(1);

    for (const p of TAP_PRIZES) await setThaiText(page, "tap-fast", "", "", p.en);
  });
});
