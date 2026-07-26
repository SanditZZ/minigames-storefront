// CALCULATIONS: whether a client can scan a QR at all, and what to say when it
// cannot.
//
// This is pure on purpose. Every fact it needs is a boolean the app layer reads
// off `window`/`navigator` — which a package may not touch — and the interesting
// part is not the reading but the *ranking*: there are three separate reasons a
// scanner may be unavailable, they need different answers, and only one of them
// is fixable by the person holding the phone.

/** What a client can do about scanning right now. */
export type ScanAvailability =
  | { kind: "ready" }
  /** The page is not a secure context, so the camera API does not exist. */
  | { kind: "insecureOrigin"; reason: string }
  /** Secure, but this browser has no camera to offer. */
  | { kind: "noCamera"; reason: string }
  /** Camera available, but nothing here can decode a QR from its frames. */
  | { kind: "noDecoder"; reason: string };

/** The environment facts, gathered by the app layer. */
export interface ScanEnvironment {
  /** `window.isSecureContext` — HTTPS, or localhost. */
  secureContext: boolean;
  /** Whether `navigator.mediaDevices?.getUserMedia` exists. */
  mediaDevices: boolean;
  /** Whether `window.BarcodeDetector` exists. */
  barcodeDetector: boolean;
}

/**
 * Ranks the reasons scanning is unavailable, most fundamental first.
 *
 * The order matters more than it looks. On this project's own stack ALL THREE can
 * be false at once — the apps are served over plain HTTP on a Tailscale address,
 * so `navigator.mediaDevices` is `undefined` (the same rule that makes
 * `navigator.clipboard` absent; see the player's clipboard/copy.ts), and
 * Chromium on Linux ships no `BarcodeDetector` either. Reporting "this browser
 * cannot decode QR codes" to someone whose actual problem is the URL scheme
 * sends them to fix the wrong thing.
 *
 * `noDecoder` is last because it is the one with no local remedy: HTTPS fixes the
 * first, a different device fixes the second, and the third needs either a
 * Chromium-family browser or a decoder shipped into the bundle — which is a
 * dependency decision, not a setting. The native admin sidesteps all three;
 * `expo-camera` is not bound by any of these rules.
 */
export function scanAvailability(env: ScanEnvironment): ScanAvailability {
  if (!env.secureContext) {
    return {
      kind: "insecureOrigin",
      reason: "Scanning needs HTTPS. This page is served over plain HTTP, so the browser hides the camera entirely — type the code, or use the phone app.",
    };
  }
  if (!env.mediaDevices) {
    return { kind: "noCamera", reason: "This browser offers no camera. Type the code instead." };
  }
  if (!env.barcodeDetector) {
    return {
      kind: "noDecoder",
      reason: "This browser cannot decode QR codes. Chrome or Edge can, and the phone app always can.",
    };
  }
  return { kind: "ready" };
}

/** Whether the scan control should be offered at all. */
export function canScan(env: ScanEnvironment): boolean {
  return scanAvailability(env).kind === "ready";
}
