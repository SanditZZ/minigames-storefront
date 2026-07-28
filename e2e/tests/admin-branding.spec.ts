import { expect, test } from "@playwright/test";
import {
  admin,
  openAdmin,
  resetBrandingColours,
  rootVar,
  writeBranding,
} from "../helpers/admin";
import { coldContext } from "../helpers/cold";
import { ui } from "../helpers/round";
import { BUNDLED_STORE_NAME, SEEDED_STORE_NAME, WEB_URL } from "../stack";

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
 *
 * Every write here goes through `writeBranding` rather than fill-click-assert,
 * so that a RETRY of a test that already saved reports the assertion that broke
 * instead of a timeout on a button with nothing left to do. See the helper.
 */

/** Nothing near the warm palette, so a stale value cannot pass by accident. */
const TEAL = "#00b3a4";

test.describe("store branding", () => {
  test("renaming the store changes what the player's header says", async ({ page }) => {
    const renamed = "Tailnet Coffee";

    await page.goto("/");
    await expect(page.getByText(SEEDED_STORE_NAME)).toBeVisible();

    await openAdmin(page, "/settings");
    await writeBranding(page, admin.storeName(page), renamed);

    await page.goto("/");
    await expect(page.getByText(renamed)).toBeVisible();
    // The seeded name is gone rather than merely joined, which is what tells a
    // fallback apart from a value: `storeIdentity` falls back PER FIELD, so a
    // half-working rename shows both.
    await expect(page.getByText(SEEDED_STORE_NAME)).toBeHidden();
    // And the bundle's own fallback never appears either. It is a DIFFERENT
    // string from the seed on purpose (see stack.ts), so this distinguishes "the
    // rename was fetched" from "the settings request failed and the client fell
    // back", which spelling both the same way used to hide.
    await expect(page.getByText(BUNDLED_STORE_NAME)).toBeHidden();

    // Restore, and confirm the restore itself reached the player — an
    // un-asserted cleanup that silently failed would poison the whole suite.
    await openAdmin(page, "/settings");
    await writeBranding(page, admin.storeName(page), SEEDED_STORE_NAME);

    await page.goto("/");
    await expect(page.getByText(SEEDED_STORE_NAME)).toBeVisible();
  });

  test("a returning player sees the store before the settings arrive", async ({ browser, page }) => {
    // The store's identity used to land one request after the first paint: the
    // palette repainted, the wordmark changed from the bundled fallback to the
    // shop's own name, and the cover banner APPEARED — shoving the game list down a third of
    // the viewport under a thumb already reaching for it. The player now starts
    // from the copy the last visit left in `localStorage`
    // (`state/settingsCache.ts`, decoded by `player-core/src/settings/cache.ts`).
    //
    // A cold first frame is not a thing Playwright can assert — it is over before
    // an assertion can run, and polling for it is a race. Cutting the endpoint
    // off is the same claim from the other side: whatever the page renders with
    // no settings request in flight can only have come from the remembered copy.
    //
    // In a SECOND context, not a reload of this one. See helpers/cold.ts: a
    // reload is served from Chromium's memory cache, which `page.route` never
    // sees, so the first version of this test passed against a build with the
    // cache removed.
    const renamed = "Cached Coffee";

    await openAdmin(page, "/settings");
    await writeBranding(page, admin.storeName(page), renamed);

    // The visit that fills the copy.
    await page.goto("/");
    await expect(page.getByText(renamed)).toBeVisible();

    const cold = await coldContext(browser, page);
    const returning = await cold.newPage();
    let blocked = 0;
    // A regex, unanchored, and both details were paid for. A glob
    // (`**/settings/public`) matches nothing here, and an anchored regex misses
    // too: every player fetch carries the language as a query
    // (`?lang=en` — see apiFor), so the URL does not END with the path. Either
    // mistake fails SILENTLY, the handler simply never running while the request
    // goes through, which is how this test twice passed against a build with the
    // cache removed. The counter below is what turned that into a failure.
    await returning.route(/\/settings\/public/, (route) => {
      blocked++;
      return route.abort();
    });

    await returning.goto("/");
    await expect(returning.getByText(renamed)).toBeVisible();
    // And the fallback never got its turn, which is the part that distinguishes
    // a remembered copy from a merely fast one: a failed request must not erase
    // a good copy. This is the assertion the two names being one string blunted
    // most — with the request aborted, the bundled fallback is the ONLY other
    // thing this header could have said.
    await expect(returning.getByText(BUNDLED_STORE_NAME)).toBeHidden();
    // The whole test rests on this: a block that did not happen would leave
    // every assertion above passing for the ordinary reason.
    expect(blocked).toBeGreaterThan(0);
    await cold.close();

    await openAdmin(page, "/settings");
    await writeBranding(page, admin.storeName(page), SEEDED_STORE_NAME);

    await page.goto("/");
    await expect(page.getByText(SEEDED_STORE_NAME)).toBeVisible();
  });

  test("a chosen colour reaches both apps, and clearing it gives the token back", async ({ page }) => {
    await openAdmin(page, "/settings");

    // Captured rather than hard-coded: the token's value lives in
    // packages/tokens, which this package cannot import — it sits outside the
    // frontend workspace on purpose. Reading the baseline asserts the round
    // trip without restating a constant that would drift silently.
    const token = await rootVar(page, "--color-brand");
    expect(token).not.toBe(TEAL);

    await writeBranding(page, admin.colorHex(page, "Coral"), TEAL);

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
    await resetBrandingColours(page);

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
    await writeBranding(page, admin.storeBanner(page), cover);

    await page.goto("/");
    await expect(ui.banner(page, cover)).toBeVisible();

    // Clearing is the half worth asserting as much as setting it. An unset
    // banner has to render NOTHING rather than a placeholder — a storefront
    // that has not configured one should look finished — and "" reaching an
    // <img src> instead of being read as absent is the way that breaks.
    await openAdmin(page, "/settings");
    await writeBranding(page, admin.storeBanner(page), "");

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
