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
    await admin.lookUp(page).click();

    // The confirmation has to name the PRIZE as well as the code — an operator
    // is about to hand over an object, and a bare code is not enough to catch
    // having looked up the wrong claim. Which prize it is depends on how many
    // taps the round landed, so this asserts the shape rather than the words.
    await expect(admin.confirm(page)).toContainText(
      new RegExp(`^Hand over .+ for ${raw(grouped)}\\?`),
    );
    await admin.confirmRedeem(page).click();

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
    await admin.lookUp(page).click();
    await admin.confirmRedeem(page).click();
    await expect(admin.handedOver(page)).toBeVisible();

    // Single-use is the entire reason the credential is a server-issued code
    // rather than the result screen itself. A screenshot forwarded to a friend
    // buys them nothing once the original has been collected — that cap is what
    // this asserts, and it is only observable end to end.
    await admin.codeField(page).fill(grouped);
    await admin.lookUp(page).click();
    // The lookup still SUCCEEDS on a spent code — it is a read, and the counter
    // needs to see what happened to it. The refusal comes from confirming.
    await admin.confirmRedeem(page).click();

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
    await admin.lookUp(page).click();

    await expect(page.getByText(/No claim with that code/i)).toBeVisible();
    // And it must not offer to hand over a claim it could not find.
    await expect(admin.confirm(page)).toBeHidden();
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
    // the customer cannot find their code. A row already holds the claim, so it
    // confirms without a second lookup — but it still confirms.
    await admin.redeemRow(page, code).click();
    await admin.confirmRedeem(page).click();
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

  /**
   * The confirmation is a GATE, not a notification.
   *
   * This is the assertion the scan-to-redeem work exists for: a camera fires the
   * trigger, so the press that opens the question must not also answer it. The
   * test proves the prize is still owed after the prompt appears — i.e. that no
   * POST happened — and that cancelling leaves it that way.
   */
  test("asks before handing anything over, and cancelling changes nothing", async ({ page }) => {
    const grouped = await winACode(page, "Careful");
    const code = raw(grouped);

    await openAdmin(page, "/claims?status=issued");
    await admin.redeemRow(page, code).click();

    await expect(admin.confirm(page)).toContainText(code);
    // Nothing was written: the claim is still in the OUTSTANDING filter, which
    // it would have left the instant a redemption landed.
    await expect(admin.claimRow(page, code)).toBeVisible();
    await expect(admin.handedOver(page)).toBeHidden();

    await admin.cancel(page).click();
    await expect(admin.confirm(page)).toBeHidden();

    // Reloaded from the server rather than trusted from the DOM: the question is
    // whether the BACKEND still has it outstanding, and only a fresh fetch of
    // ?status=issued can answer that.
    await page.reload();
    await expect(admin.claimRow(page, code)).toBeVisible();
    await expect(admin.redeemRow(page, code)).toBeVisible();
  });

  /**
   * The repair for a mis-scan, which had no inverse before this work: a
   * redemption can be taken back, and the prize becomes collectable again.
   *
   * Note what this does NOT weaken — "refuses the same code a second time"
   * above still passes, because undoing is a separate endpoint reached by a
   * separate control. If a future change wires an undo into the redeem path,
   * that test is the one that should go red.
   */
  test("undoes a collection, and the prize can then be collected again", async ({ page }) => {
    const grouped = await winACode(page, "Mistake");
    const code = raw(grouped);

    await openAdmin(page, "/claims?status=issued");
    await admin.redeemRow(page, code).click();
    await admin.confirmRedeem(page).click();
    await expect(admin.handedOver(page)).toBeVisible();

    // The undo lives on the collected row — the only place it means anything.
    await admin.statusFilter(page).selectOption("redeemed");
    await expect(admin.claimRow(page, code)).toBeVisible();
    await admin.undoRow(page, code).click();

    // The prompt admits the undo may land on "expired" rather than promising it
    // comes back collectable, because the collection window is the server's fact.
    await expect(admin.confirm(page)).toContainText(/expired/i);
    await admin.confirmUndo(page).click();

    // And the banner reports what the SERVER said the claim became, not a guess.
    await expect(admin.undone(page)).toHaveText(
      new RegExp(`^Collection undone: .+ \\(${code}\\) is now outstanding\\.$`),
    );
    // It left the collected list the same way a redemption leaves the outstanding
    // one — the list is reloaded, not patched.
    await expect(admin.claimRow(page, code)).toHaveCount(0);

    // The real proof that the undo worked: the code redeems again. A status flip
    // that left the claim uncollectable would be a worse bug than no undo at all.
    await admin.codeField(page).fill(grouped);
    await admin.lookUp(page).click();
    await admin.confirmRedeem(page).click();
    await expect(admin.handedOver(page)).toBeVisible();
  });
});
