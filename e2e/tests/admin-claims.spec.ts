import { expect, test } from "@playwright/test";
import { playRound, revealScore, ui } from "../helpers/round";
import { admin, openAdmin } from "../helpers/admin";

/**
 * The counter's half of the claim transaction.
 *
 * Everything below this line was previously untested in a browser. The player's
 * side — winning a code, seeing it, copying it — has been covered since the
 * lifecycle shipped; the side where someone actually hands over a coffee had
 * unit tests on its pure parts (admin-core/claims/present.ts) and nothing else,
 * because the admin app was not in the Playwright webServer list.
 *
 * The tests deliberately run BOTH apps in one page. A claim is the one object in
 * this system that crosses from the player to the operator, and each app's own
 * suite can pass in full while the handover is broken: the player mints a code
 * the admin cannot find, or the admin redeems something the player was never
 * shown. That seam is the whole point, so no test here fabricates a code — every
 * one is won by playing a round first.
 */

/**
 * The player's grouped display form → the raw code the backend stores.
 *
 * `ClaimCard` shows `ABCD-2345` and `ClaimRow` shows `ABCD2345`. Both are the
 * same claim: the dash is presentation, inserted by `groupClaimCode` so eight
 * characters can be read aloud across a counter. The admin's lookup normalises
 * it away, which is what lets the tests below type the form the customer is
 * actually looking at.
 */
const raw = (grouped: string) => grouped.replace("-", "");

/** Plays a winning round and returns the code as the player sees it. */
async function winACode(page: import("@playwright/test").Page, name: string): Promise<string> {
  await playRound(page, name);
  await revealScore(page);
  const code = ui.claimCode(page);
  await expect(code).toBeVisible();
  return (await code.innerText()).trim();
}

test.describe("the counter", () => {
  test("redeems the code the player is holding, typed as they read it out", async ({ page }) => {
    const grouped = await winACode(page, "Counter");

    await openAdmin(page, "/claims");
    // The dash included, because that is what is on the customer's screen. A
    // lookup that only accepted the stored form would make every redemption a
    // transcription exercise.
    await admin.codeField(page).fill(grouped);
    await admin.redeem(page).click();

    // The confirmation has to name the PRIZE as well as the code — an operator
    // is about to hand over an object, and "done" is not enough to catch having
    // redeemed the wrong claim. Which prize it is depends on how many taps the
    // round landed, so this asserts the shape rather than the words.
    await expect(admin.handedOver(page)).toHaveText(
      new RegExp(`^Handed over: .+ \\(${raw(grouped)}\\)$`),
    );

    // The box empties itself: the next customer in the queue starts from blank
    // rather than from the previous person's code.
    await expect(admin.codeField(page)).toHaveValue("");
  });

  test("refuses the same code a second time", async ({ page }) => {
    const grouped = await winACode(page, "Twice");

    await openAdmin(page, "/claims");
    await admin.codeField(page).fill(grouped);
    await admin.redeem(page).click();
    await expect(admin.handedOver(page)).toBeVisible();

    // Single-use is the entire reason the credential is a server-issued code
    // rather than the result screen itself. A screenshot forwarded to a friend
    // buys them nothing once the original has been collected — that cap is what
    // this asserts, and it is only observable end to end.
    await admin.codeField(page).fill(grouped);
    await admin.redeem(page).click();

    await expect(page.getByText(/already been redeemed/i)).toBeVisible();
    // And the success line from the first redemption is gone rather than left
    // sitting above a failure, which would read as "it worked" at a glance.
    await expect(admin.handedOver(page)).toBeHidden();
  });

  test("says so when the code does not exist", async ({ page }) => {
    await openAdmin(page, "/claims");

    // A plausible-looking code from the same alphabet: this is the mistyped
    // transcription, not a malformed string, so the panel has to distinguish
    // "check the characters" from "already used".
    await admin.codeField(page).fill("ZZZZ-9999");
    await admin.redeem(page).click();

    await expect(page.getByText(/No claim with that code/i)).toBeVisible();
  });

  test("a redeemed claim leaves the outstanding list", async ({ page }) => {
    const grouped = await winACode(page, "Moved");
    const code = raw(grouped);

    await openAdmin(page, "/claims?status=issued");

    // It starts life owed. The row button carries the code in its accessible
    // name precisely so one row out of many can be addressed.
    await expect(admin.redeemRow(page, code)).toBeVisible();

    // Redeemed from the row rather than the box: it is the other of the two
    // ways a claim can be collected, and it is the one an operator uses when
    // the customer cannot find their code.
    await admin.redeemRow(page, code).click();
    await expect(admin.handedOver(page)).toBeVisible();

    // The list is RELOADED after a redemption rather than patched, because the
    // claim no longer belongs in this filter at all — see the comment on
    // ClaimsPanel.redeem. A row editing itself in place would leave the panel
    // showing a collected prize under "Outstanding".
    await expect(admin.claimRow(page, code)).toHaveCount(0);

    // And it is not lost — it moved. The filter is a real query parameter, so
    // switching it is addressable and a colleague can be sent the same view.
    await admin.statusFilter(page).selectOption("redeemed");
    await expect(page).toHaveURL(/status=redeemed/);
    await expect(admin.claimRow(page, code)).toBeVisible();
    await expect(admin.claimRow(page, code)).toContainText("Collected");
    // No Redeem button on a collected claim: the row offers the action only
    // while it is still owed.
    await expect(admin.redeemRow(page, code)).toBeHidden();
  });
});
