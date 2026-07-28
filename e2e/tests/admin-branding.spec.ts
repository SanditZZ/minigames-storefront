import { expect, test } from "@playwright/test";
import { admin, openAdmin, rootVar } from "../helpers/admin";
import { ui } from "../helpers/round";
import { WEB_URL } from "../stack";

/**
 * Store branding, from the operator's form to the player's screen.
 *
 * This is the feature that was verified by unit tests on either side of a wire
 * nobody crossed. `settings/public_test.go` pins the allowlist,
 * `player-core/src/brand.test.ts` pins the fallbacks, `tokens/override.test.ts`
 * pins the precedence rule — and all three pass just as happily if the player
 * never asks for the settings, or asks and ignores them.
 *
 * The palette half is worse than the rename half, and it is the reason these
 * tests exist. `paletteCssVars` is pure and covered; the line that hands its
 * output to `document.documentElement.style` lives in `useBrandPalette`, which
 * each app keeps its own copy of and which no test of any kind could reach
 * before the admin app was in the webServer list. A rename that fails to apply
 * is one wrong word; a palette that fails to apply is the whole app in the
 * wrong colours.
 *
 * ## Every test here restores what it changed
 *
 * These settings are global to the throwaway stack and the suite shares one
 * backend, so an override left behind would re-colour — or rename — every test
 * that runs afterwards. This file sorts FIRST alphabetically, so "afterwards"
 * means all of them. The restore is not tidiness; it is the reason the other
 * specs can assume a default storefront.
 *
 * It is also worth asserting rather than merely performing: "clearing an
 * override reverts to the token" is a claim the tokens doc makes explicitly,
 * and the mechanism (remove the property, let the cascade fall back to the
 * compiled @theme block) is exactly as browser-only as setting it.
 */

/** Nothing near the warm palette, so a stale value cannot pass by accident. */
const TEAL = "#00b3a4";

test.describe("store branding", () => {
  test("renaming the store changes what the player's header says", async ({ page }) => {
    const renamed = "Tailnet Coffee";

    await page.goto("/");
    await expect(page.getByText("Fun Store")).toBeVisible();

    await openAdmin(page, "/settings");
    await admin.storeName(page).fill(renamed);
    await admin.saveBranding(page).click();
    // The form re-reads what was stored, so Save going quiet is the app's own
    // signal that the write landed — not a fixed wait.
    await expect(admin.saveBranding(page)).toBeDisabled();

    await page.goto("/");
    await expect(page.getByText(renamed)).toBeVisible();
    // The seeded name is gone rather than merely joined, which is what tells a
    // fallback apart from a value: `storeIdentity` falls back PER FIELD, so a
    // half-working rename shows both.
    await expect(page.getByText("Fun Store")).toBeHidden();

    // Restore, and confirm the restore itself reached the player — an
    // un-asserted cleanup that silently failed would poison the whole suite.
    await openAdmin(page, "/settings");
    await admin.storeName(page).fill("Fun Store");
    await admin.saveBranding(page).click();
    await expect(admin.saveBranding(page)).toBeDisabled();

    await page.goto("/");
    await expect(page.getByText("Fun Store")).toBeVisible();
  });

  test("a chosen colour reaches both apps, and clearing it gives the token back", async ({ page }) => {
    await openAdmin(page, "/settings");

    // Captured rather than hard-coded: the token's value lives in
    // packages/tokens, which this package cannot import — it sits outside the
    // frontend workspace on purpose. Reading the baseline asserts the round
    // trip without restating a constant that would drift silently.
    const token = await rootVar(page, "--color-brand");
    expect(token).not.toBe(TEAL);

    await admin.colorHex(page, "Coral").fill(TEAL);
    await admin.saveBranding(page).click();
    await expect(admin.saveBranding(page)).toBeDisabled();

    // The admin wears the store's colours itself, which is the whole argument
    // for choosing one here: an operator sees the result instead of guessing.
    // No reload — the shell re-reads settings after a save and re-applies.
    await expect.poll(() => rootVar(page, "--color-brand")).toBe(TEAL);

    // And the player, on its own origin, through its own copy of the hook and
    // its own public-settings fetch. This is the assertion the feature never
    // had: two ~15-line modules that write to `documentElement`, neither
    // reachable from a unit test.
    await page.goto("/");
    await expect.poll(() => rootVar(page, "--color-brand")).toBe(TEAL);

    // Clearing is not the same operation as setting: the save DELETES the
    // setting row, and the hook REMOVES the custom property rather than writing
    // the old value back — which is what lets the cascade fall through to the
    // compiled @theme block with nothing needing to know what it said.
    await openAdmin(page, "/settings");
    await admin.resetColours(page).click();
    await admin.saveBranding(page).click();
    await expect(admin.saveBranding(page)).toBeDisabled();

    await expect.poll(() => rootVar(page, "--color-brand")).toBe(token);

    await page.goto("/");
    await expect.poll(() => rootVar(page, "--color-brand")).toBe(token);
  });

  test("a cover banner reaches the landing screen, and clearing it takes it away", async ({
    page,
  }) => {
    // An asset the throwaway stack actually serves, from the player's own
    // origin, so the <img> genuinely loads. A made-up URL would pass the
    // visibility check anyway — the banner's container carries the 3:1 aspect
    // box, so a broken image still has size — which is the kind of green that
    // means nothing.
    const cover = `${WEB_URL}/favicon.svg`;

    await page.goto("/");
    await expect(ui.banner(page, cover)).toBeHidden();

    await openAdmin(page, "/settings");
    await admin.storeBanner(page).fill(cover);
    await admin.saveBranding(page).click();
    await expect(admin.saveBranding(page)).toBeDisabled();

    await page.goto("/");
    await expect(ui.banner(page, cover)).toBeVisible();

    // Clearing is the half worth asserting as much as setting it. An unset
    // banner has to render NOTHING rather than a placeholder — a storefront
    // that has not configured one should look finished — and "" reaching an
    // <img src> instead of being read as absent is the way that breaks.
    await openAdmin(page, "/settings");
    await admin.storeBanner(page).fill("");
    await admin.saveBranding(page).click();
    await expect(admin.saveBranding(page)).toBeDisabled();

    await page.goto("/");
    await expect(ui.banner(page, cover)).toBeHidden();
  });

  test("a colour the parser refuses is never saved", async ({ page }) => {
    await openAdmin(page, "/settings");

    // `url(...)` is the case the narrow hex check exists for: valid CSS, and it
    // would land in a live custom property and have every player's browser
    // fetch a third-party asset. The form has to refuse it before the request,
    // and the backend refuses it again — see settings.IsHexColor.
    await admin.colorHex(page, "Coral").fill("url(https://example.com/x.png)");

    await expect(page.getByText(/Not a colour/i)).toBeVisible();
    await expect(admin.saveBranding(page)).toBeDisabled();

    // Nothing was written, so nothing to clean up — asserted rather than
    // assumed, because a disabled button that still submitted would leave the
    // rest of the suite running against a broken palette.
    const token = await rootVar(page, "--color-brand");
    expect(token).not.toBe("url(https://example.com/x.png)");
  });
});
