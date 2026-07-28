import { devices, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { WEB_URL } from "../stack";

/**
 * A browser that has never talked to this stack, carrying only what an earlier
 * visit left in storage.
 *
 * `page.reload()` is NOT a cold load, and the difference is not academic — it is
 * what made the first version of the settings-cache test pass against a build
 * with the cache ripped out. Chromium serves a repeat request from its in-memory
 * cache without going to the network, and `page.route` intercepts the NETWORK:
 * no request, no handler, no abort. The endpoint under test answered normally
 * and the assertion could not fail.
 *
 * A new context has an empty HTTP cache, so every request genuinely leaves the
 * browser and every route handler genuinely runs. Seeding it with the previous
 * context's `storageState` is what makes it a *returning* visitor rather than a
 * new one: localStorage crosses, the response cache does not, which is exactly
 * the shape of a customer opening the storefront the next morning.
 *
 * A spec that blocks a request must assert its handler ran. A route that never
 * fires is indistinguishable from one that fired and was harmless, and the
 * second reading is the one a green test invites.
 */
export async function coldContext(browser: Browser, from: Page): Promise<BrowserContext> {
  const storageState = await from.context().storageState();
  // The device and baseURL come from playwright.config.ts for the default
  // context only; a hand-made one gets neither unless it is told, and a
  // desktop-width context would quietly test a layout no kiosk runs.
  return browser.newContext({ ...devices["Pixel 7"], baseURL: WEB_URL, storageState });
}
