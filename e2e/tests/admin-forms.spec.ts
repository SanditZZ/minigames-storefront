import { expect, test } from "@playwright/test";
import { admin, openAdmin, openAwardForm } from "../helpers/admin";

/**
 * The two admin controls whose interesting behaviour a pure test cannot reach.
 *
 * Both halves of each are already unit-tested — `settings/number.ts` for the
 * parsing, clamping and step bounds, `tokens/contrast.ts` for the ratio — and
 * both of those pass while the wiring around them is wrong. What is left is
 * behaviour that only exists in a browser: a timer that repeats while a button
 * is held, a draft string that keeps a cleared field from becoming 0, and an
 * alert that has to appear WITHOUT disabling the Save underneath it.
 *
 * ## Nothing here saves, and that is the cleanup strategy
 *
 * The suite shares one backend, so a spec that writes has to restore what it
 * changed. These tests never click Save: the stepper test cancels out of the
 * award form and the contrast test navigates away from the branding form, both
 * of which drop the draft with the stored value untouched. That is not a
 * shortcut — a control's behaviour before submission is exactly what is under
 * test, and writing would only add a cleanup that could fail.
 */

/** A prize that is seeded with FINITE stock, so the Stock field is rendered. */
const FINITE_STOCK_PRIZE = "Free Coffee";

/** Nothing near the warm palette, and dark enough that ink on it fails AA. */
const NEAR_BLACK = "#2b2b2b";

test.describe("the award form's stock stepper", () => {
  test("repeats while held, rather than stepping once per press", async ({ page }) => {
    await openAwardForm(page, "tap-fast", FINITE_STOCK_PRIZE);

    const stock = page.getByLabel("Stock", { exact: true });
    const started = Number(await stock.inputValue());

    // Held, not clicked. `mouse.down` without an `up` is the only way to reach
    // the repeat: the first step fires on pointerdown, and the interval behind
    // it starts 400ms later (REPEAT_DELAY_MS in ui/Controls.tsx).
    //
    // `hover()` before it, and not for tidiness: the mouse API takes VIEWPORT
    // coordinates and does not scroll, while the Stock field sits far enough
    // down this form to be below the fold. Pressing at a bounding box read
    // without scrolling first lands the pointer on whatever is at those
    // coordinates instead — which is nothing, silently, so the first version of
    // this test failed with the value still at its starting number.
    const plus = page.getByRole("button", { name: "Increase Stock" });
    await plus.hover();
    await page.mouse.down();

    // Polled rather than slept, so this asserts the repeat HAPPENED instead of
    // asserting that 700ms passed. A stepper that fires once per press leaves
    // the value at started+1 and this fails by timeout — which is the exact
    // regression the timer cleanup is most likely to cause.
    await expect
      .poll(async () => Number(await stock.inputValue()), {
        message: "held + should keep stepping past the first press",
      })
      .toBeGreaterThan(started + 1);

    await page.mouse.up();

    // And it STOPS. An interval left running past pointerup is the other half of
    // the same bug and is invisible to any assertion taken while the button is
    // still down — the timer cleanup is the fiddliest part of that component and
    // the part with no coverage at all before this.
    //
    // The one fixed wait in this suite, and it is the assertion rather than
    // padding: "nothing happens from here on" can only be observed by letting
    // time pass. Five repeat intervals (REPEAT_EVERY_MS = 60) is long enough
    // that a leaked timer has fired several times.
    const atRelease = Number(await stock.inputValue());
    await page.waitForTimeout(300);
    expect(Number(await stock.inputValue()), "the repeat kept running after pointerup").toBe(atRelease);

    await page.getByRole("button", { name: "Cancel" }).click();
  });

  test("a cleared field stays empty instead of becoming zero under the cursor", async ({ page }) => {
    await openAwardForm(page, "tap-fast", FINITE_STOCK_PRIZE);

    const stock = page.getByLabel("Stock", { exact: true });
    await stock.fill("");

    // The draft is the point: an operator who selects-all and deletes, meaning
    // to type 250, must not watch the field snap to 0 between keystrokes — and
    // a stock of 0 is a prize nobody can win, so the wrong behaviour here is
    // both surprising and consequential.
    await expect(stock).toHaveValue("");

    await page.getByRole("button", { name: "Cancel" }).click();
  });
});

test.describe("the branding form's contrast warning", () => {
  test("warns about an illegible palette and still lets the operator save", async ({ page }) => {
    await openAdmin(page, "/settings");
    await expect(page.getByText(/Hard to read/i)).toBeHidden();

    await admin.colorHex(page, "Coral").fill(NEAR_BLACK);

    // Ink is a dark brown, so ink-on-near-black is well under AA. That the
    // warning names a ratio is `lowContrastPairs`' job and is unit-tested; what
    // is only true in a browser is that the alert reaches the screen at all.
    await expect(page.getByText(/Hard to read/i)).toBeVisible();

    // The assertion the feature exists for, and the one a tidy-up is most
    // likely to reverse: this is a WARNING beside a live Save, never a block. A
    // venue's real brand colour is not negotiable with a validator, and
    // refusing the save would get the palette written into SQLite by hand with
    // nobody warned at all. See the note in StoreBranding.tsx.
    await expect(admin.saveBranding(page)).toBeEnabled();

    // Away without saving — the draft dies with the page and the stored palette
    // was never touched, so there is nothing for the next spec to inherit.
    await openAdmin(page, "/settings");
    await expect(page.getByText(/Hard to read/i)).toBeHidden();
  });
});
