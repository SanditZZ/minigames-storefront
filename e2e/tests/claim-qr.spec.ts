import { expect, test, type Locator, type Page } from "@playwright/test";
import jsQR from "jsqr";
import { playRound, revealScore, ui } from "../helpers/round";
import { admin, openAdmin } from "../helpers/admin";

/**
 * The scannable half of a claim.
 *
 * This is the only test in the repo that DECODES a QR code, and that is the
 * point. `@minigames/qr-core` is unit-tested against a golden matrix, but a
 * golden matrix can only prove the encoder still does what it did yesterday —
 * not that a camera at a counter can read what the player's screen is showing.
 * Everything between the two is untested by unit tests and is exactly where this
 * kind of feature breaks: the SVG's fill resolving to a colour with no contrast,
 * the quiet zone being clipped by a rounded corner, CSS scaling the symbol down
 * until modules merge.
 *
 * So: screenshot the element as it renders, decode the pixels with an
 * independent decoder (`jsqr`, a devDependency of this package only — it never
 * enters an app bundle), and check the result against the code the counter can
 * actually redeem.
 */

const raw = (grouped: string) => grouped.replace("-", "");

/** The player's QR, addressed the way a screen reader would find it. */
const qrGlyph = (page: Page) => page.getByRole("img", { name: /QR code for claim/i });

/**
 * Decodes a QR from an element's rendered pixels.
 *
 * Two hops, each doing the part only it can:
 *
 *  1. Playwright screenshots the element — REAL pixels, at the device's scale
 *     factor, with the app's own CSS applied. Rasterising the SVG from its
 *     source instead would test a symbol nobody is looking at: custom properties
 *     like `var(--color-ink)` do not resolve inside a standalone SVG image, so a
 *     palette mistake would pass.
 *  2. The screenshot is a PNG, and Node has no PNG decoder here — so the browser
 *     decodes it back to raw luminance (it has one built in), and jsQR runs on
 *     that in Node.
 */
async function decodeQr(page: Page, element: Locator): Promise<string | null> {
  // `scale: "device"` keeps the device pixel ratio (Pixel 7 is 2.625), so a
  // 160px-wide symbol arrives as ~420px. Below roughly 3px per module jsQR
  // starts failing on antialiasing rather than on anything the app did wrong.
  const png = await element.screenshot({ scale: "device" });

  const bitmap = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    // White first, then the shot. An element screenshot keeps transparency and a
    // canvas starts transparent BLACK, so any transparent pixel would arrive as a
    // dark one and read as a module. The glyph paints its own white background, so
    // this only matters at the edges — but it is one line, and the alternative is
    // a decoder failing for a reason that has nothing to do with the app.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // One byte per pixel instead of four: the same information for a greyscale
    // symbol, and a quarter of the payload to move across the bridge.
    let bytes = "";
    for (let i = 0; i < data.length; i += 4) bytes += String.fromCharCode(data[i]);
    return { luminance: btoa(bytes), width: canvas.width, height: canvas.height };
  }, png.toString("base64"));

  const grey = Buffer.from(bitmap.luminance, "base64");
  const rgba = new Uint8ClampedArray(grey.length * 4);
  for (let i = 0; i < grey.length; i++) {
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = grey[i];
    rgba[i * 4 + 3] = 255;
  }

  return jsQR(rgba, bitmap.width, bitmap.height)?.data ?? null;
}

test.describe("the claim QR", () => {
  test("encodes the code the counter can redeem", async ({ page }) => {
    await playRound(page, "Scanner");
    await revealScore(page);

    const grouped = (await ui.claimCode(page).innerText()).trim();
    await expect(qrGlyph(page)).toBeVisible();

    /**
     * Polled rather than sampled once, and the reason is a real property of the
     * screen: the result card ENTERS on `animate-rise-in`, fading from opacity 0
     * to 1 over roughly 600ms. A QR at 30% opacity over cream has no contrast, so
     * a decode taken the instant the card appears legitimately fails — as it
     * would for a customer who holds their phone up mid-animation.
     *
     * "Becomes scannable" is therefore the honest assertion, and it is still a
     * strict one: a symbol that never decodes fails here with the same message,
     * just later. Do not replace this with a fixed wait — that was the shape of
     * flake this suite has already been bitten by once.
     *
     * The RAW code, not the grouped display form: the QR is read by a machine,
     * and the dash exists only so a human can read eight characters aloud.
     */
    // `decoded` holds what came OUT of the decoder, so the steps below redeem the
    // decoder's output rather than the string this test expected it to be.
    let decoded = "";
    await expect
      .poll(async () => (decoded = (await decodeQr(page, qrGlyph(page))) ?? ""), {
        timeout: 5_000,
        message: "the QR never decoded",
      })
      .toBe(raw(grouped));

    // …and the decoded string is genuinely the credential, not merely a
    // well-formed lookalike: the counter redeems what came out of the camera.
    await openAdmin(page, "/claims");
    await admin.codeField(page).fill(decoded);
    await admin.lookUp(page).click();
    await expect(admin.confirm(page)).toContainText(decoded);
    await admin.confirmRedeem(page).click();
    await expect(admin.handedOver(page)).toContainText(decoded);
  });

  test("is gone once the prize has been collected", async ({ page }) => {
    await playRound(page, "Collected");
    await revealScore(page);

    const grouped = (await ui.claimCode(page).innerText()).trim();
    const resultUrl = page.url();
    await expect(qrGlyph(page)).toBeVisible();

    await openAdmin(page, "/claims");
    await admin.codeField(page).fill(grouped);
    await admin.lookUp(page).click();
    await admin.confirmRedeem(page).click();
    await expect(admin.handedOver(page)).toBeVisible();

    // Back to the player's permanent result URL. The card still says what was
    // won — that history is deliberate — but the QR is withdrawn: pointing a
    // camera at a spent code is a refusal at the counter, and offering the
    // gesture invites it.
    await page.goto(resultUrl);
    await expect(ui.claimCode(page)).toBeVisible();
    await expect(qrGlyph(page)).toBeHidden();
  });
});
