import { expect, test } from "@playwright/test";
import { openAdmin } from "../helpers/admin";
import { WEB_URL } from "../stack";

/**
 * The admin's half of issue #6: getting the display URL onto a store's TV
 * without an operator having to construct it by hand.
 *
 * `VITE_PLAYER_BASE_URL` is set to `WEB_URL` for the admin's webServer entry
 * (`playwright.config.ts`) the same way `VITE_API_BASE_URL` already was, so the
 * resolved URL here is checked against the player origin this SAME suite
 * drives — not a guess about what a real deployment's Tailscale IP would be.
 */
test.describe("the display screen link", () => {
  test("resolves to the player app's own display route, and follows the game picker", async ({ page }) => {
    await openAdmin(page, "/settings");

    const gamePicker = page.getByRole("combobox", { name: "Game" });
    // `exact` matters: "store_banner_url" (ImageField's hidden aria-label
    // elsewhere on this same panel) contains "url" as a substring, and
    // getByLabel matches loosely by default.
    const url = page.getByLabel("URL", { exact: true });

    await expect(gamePicker).toHaveValue("tap-fast");
    await expect(url).toHaveValue(`${WEB_URL}/display/tap-fast`);
    await expect(page.getByRole("img", { name: /QR code for the Tap Fast display screen/i })).toBeVisible();

    await gamePicker.selectOption("reaction-timer");
    await expect(url).toHaveValue(`${WEB_URL}/display/reaction-timer`);
    await expect(page.getByRole("img", { name: /QR code for the Reaction Timer display screen/i })).toBeVisible();
  });
});
