import { describe, expect, it } from "vitest";
import { canScan, scanAvailability, type ScanEnvironment } from "./scan";

const ready: ScanEnvironment = { secureContext: true, mediaDevices: true, barcodeDetector: true };

describe("scanAvailability", () => {
  it("offers scanning only when all three facts hold", () => {
    expect(scanAvailability(ready)).toEqual({ kind: "ready" });
    expect(canScan(ready)).toBe(true);
  });

  /**
   * The ranking is the behaviour under test, not a nicety. This project's own
   * stack fails all three at once — plain HTTP over Tailscale, and Chromium on
   * Linux has no BarcodeDetector — and an operator told "this browser cannot
   * decode QR codes" would go looking for a different browser when the actual
   * problem is the URL scheme.
   */
  it("blames the origin first when everything is missing", () => {
    const result = scanAvailability({ secureContext: false, mediaDevices: false, barcodeDetector: false });
    expect(result.kind).toBe("insecureOrigin");
    expect(result.kind !== "ready" && result.reason).toMatch(/HTTPS/);
  });

  it("distinguishes the three failures", () => {
    expect(scanAvailability({ ...ready, secureContext: false }).kind).toBe("insecureOrigin");
    expect(scanAvailability({ ...ready, mediaDevices: false }).kind).toBe("noCamera");
    expect(scanAvailability({ ...ready, barcodeDetector: false }).kind).toBe("noDecoder");
  });

  it("always says what to do instead", () => {
    for (const env of [
      { ...ready, secureContext: false },
      { ...ready, mediaDevices: false },
      { ...ready, barcodeDetector: false },
    ]) {
      const result = scanAvailability(env);
      expect(result.kind).not.toBe("ready");
      // Every dead end names a way forward: typing the code, or the phone app.
      expect(result.kind !== "ready" && result.reason).toMatch(/type the code|phone app/i);
      expect(canScan(env)).toBe(false);
    }
  });
});
