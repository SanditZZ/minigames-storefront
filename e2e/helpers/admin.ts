import { expect, type Page } from "@playwright/test";
import { ADMIN_TOKEN, ADMIN_URL } from "../stack";

/**
 * Driving the admin app.
 *
 * The admin lives on its own origin, so nothing here can use `baseURL` — every
 * navigation is absolute. `openAdmin` is the only function that knows that, so
 * a spec reads as "open the claims panel" rather than as string concatenation.
 *
 * Named locators, same as helpers/round.ts: a markup change is fixed here once
 * instead of in every spec that touched the control.
 */
export const admin = {
  tokenField: (page: Page) => page.getByLabel("Admin token"),
  signIn: (page: Page) => page.getByRole("button", { name: "Sign in" }),

  // The lookup box, not a row button: the row buttons carry the code in their
  // accessible name (`Redeem claim ABCD-2345`) precisely so the two are
  // distinguishable, which is what `exact` leans on here.
  codeField: (page: Page) => page.getByLabel("Redeem a code"),
  redeem: (page: Page) => page.getByRole("button", { name: "Redeem", exact: true }),
  redeemRow: (page: Page, code: string) => page.getByRole("button", { name: `Redeem claim ${code}` }),
  /**
   * One claim's row in the list, by its stored (undashed) code.
   *
   * Scoped to list items rather than to the page, and that is not fussiness:
   * the success line reads "Handed over: Free Coffee (ABCD2345)", so a bare
   * `getByText(code)` matches the confirmation as well as the row and an
   * "it left the list" assertion can never fail.
   */
  claimRow: (page: Page, code: string) => page.getByRole("listitem").filter({ hasText: code }),
  handedOver: (page: Page) => page.getByText(/^Handed over:/),
  statusFilter: (page: Page) => page.getByLabel("Filter claims by status"),

  // `exact` matters here: getByLabel matches substrings, and the logo field's
  // hint reads "Replaces the store name above the headline", so a loose match
  // resolves to two controls.
  storeName: (page: Page) => page.getByLabel("Store name", { exact: true }),
  /** The hex box for one palette colour, by the colour's own name ("Coral"). */
  colorHex: (page: Page, colour: string) => page.getByLabel(`${colour} hex value`, { exact: true }),
  saveBranding: (page: Page) => page.getByRole("button", { name: /Save branding/ }),
  resetColours: (page: Page) => page.getByRole("button", { name: /Reset colours to default/ }),
};

/**
 * Opens an admin panel by its path and gets past the shared-secret gate.
 *
 * The sign-in is done through the form rather than by seeding localStorage,
 * which would be one line shorter and would leave `TokenGate` — the app's only
 * gate — untested. It costs one API round trip per test.
 *
 * The path is a real assertion, not decoration: every admin view is supposed to
 * be addressable (see admin-core/src/router/routes.ts), so arriving at
 * `/claims` directly is the behaviour, and a test that clicked its way there
 * from the default tab would pass just as happily with the router removed.
 */
export async function openAdmin(page: Page, path = "/"): Promise<void> {
  await page.goto(`${ADMIN_URL}${path}`);

  // A fresh browser context has an empty localStorage, so the gate is always
  // showing on the first visit of a test — but not on later ones within it,
  // which is why this is conditional rather than unconditional.
  if (await admin.tokenField(page).isVisible()) {
    await admin.tokenField(page).fill(ADMIN_TOKEN);
    await admin.signIn(page).click();
  }

  await expect(admin.tokenField(page)).toBeHidden();
}

/**
 * Reads a CSS custom property off the document element.
 *
 * This is the one thing `useBrandPalette` actually does, and the one thing no
 * other layer can observe: `paletteCssVars` is unit-tested and pure, and the
 * line that hands its output to `documentElement.style` exists only in a
 * browser. Both apps keep their own ~15-line copy of it — see the header
 * comment in either — so both are worth asking.
 */
export function rootVar(page: Page, prop: string): Promise<string> {
  return page.evaluate(
    (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    prop,
  );
}

/**
 * The awards panel. Editing is addressed by FILTERING to one prize rather than
 * by picking one "Edit" button out of many identical ones: every row's button
 * carries the same accessible name, so a bare `getByRole("button", {name:
 * "Edit"})` is ambiguous by construction. Narrowing with the panel's own
 * `?game=&q=` filters is what an operator does anyway, and it keeps the test
 * honest about which prize it opened.
 */
export const awards = {
  editOnly: (page: Page) => page.getByRole("button", { name: "Edit" }),
  // getByROLE, not getByLabel, and the difference is not stylistic.
  //
  // `Field` associates its text by WRAPPING the control in a <label>, and
  // Playwright's getByLabel matches such a label by its textContent. React
  // renders a controlled <textarea value=…> by setting defaultValue, which the
  // DOM reflects as the element's child TEXT NODE — so the moment a description
  // has content, the label's textContent becomes "Description — ไทย
  // (optional)แตะให้ได้ 40 ครั้ง" and an exact getByLabel silently stops
  // matching. It works on an empty form and fails on a populated one, which is
  // the worst possible failure schedule.
  //
  // The accessible NAME is correct throughout — verified with getByRole, which
  // is why this is a locator fix and not an app fix: the accname algorithm skips
  // the embedded control when computing its own name, so a screen reader hears
  // "Description — ไทย (optional)" either way.
  nameTh: (page: Page) => page.getByRole("textbox", { name: "Name — ไทย (optional)", exact: true }),
  descriptionTh: (page: Page) =>
    page.getByRole("textbox", { name: "Description — ไทย (optional)", exact: true }),
  save: (page: Page) => page.getByRole("button", { name: /Save award/ }),
};

/** URL for the awards panel narrowed to a single prize. */
export function oneAward(game: string, query: string): string {
  return `/awards?game=${game}&q=${encodeURIComponent(query)}`;
}
