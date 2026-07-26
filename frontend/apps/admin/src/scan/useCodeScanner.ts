// ACTIONS layer: the camera, and the browser's barcode decoder.
//
// It lives in the app rather than in @minigames/admin-core for the usual reason —
// it touches `navigator`, `window` and a `<video>` element. The *decision* of
// whether scanning is possible at all is pure and lives in the package
// (`scanAvailability`); this file only reads the facts that decision needs and
// runs the stream.

import { useCallback, useEffect, useRef, useState } from "react";
import { scanAvailability, type ScanAvailability, type ScanEnvironment } from "@minigames/admin-core";

/**
 * `BarcodeDetector` is not in TypeScript's DOM library, and is Chromium-only at
 * runtime. Declared as narrowly as this file actually uses it rather than pulling
 * in an ambient d.ts — nothing else in the app should be tempted to depend on it.
 */
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function detectorCtor(): BarcodeDetectorCtor | undefined {
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
}

/** Reads the environment. The only place these three globals are touched. */
export function scanEnvironment(): ScanEnvironment {
  return {
    secureContext: window.isSecureContext,
    mediaDevices: typeof navigator.mediaDevices?.getUserMedia === "function",
    barcodeDetector: typeof detectorCtor() === "function",
  };
}

/** How often to sample the video for a code. ~7/s is well under a frame budget
 *  and fast enough that a code held up reads as instant. */
const SAMPLE_MS = 140;

interface Scanner {
  /** Where the availability check landed — `ready` means the button is offered. */
  availability: ScanAvailability;
  /** Whether the camera is currently open. */
  scanning: boolean;
  /** Attach to the `<video>` element the preview renders into. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  start: () => void;
  stop: () => void;
  /** Set when the camera itself failed — permission denied, or no device. */
  error: string;
}

/**
 * Opens the camera and calls `onCode` the first time it decodes anything.
 *
 * It stops the stream before handing the value over. A scanner that keeps
 * decoding while a confirmation is on screen would re-fire on the same code (and
 * on the *next* code someone waves past), and the whole point of the confirm step
 * is that exactly one claim is under consideration at a time.
 *
 * Every exit path — unmount, an error, a successful read — goes through `stop`,
 * because a `MediaStream` left running holds the camera and its indicator light
 * on. On a shared counter phone that reads as the app spying rather than as a
 * leak, which is the kind of bug staff do not report and do not forget.
 */
export function useCodeScanner(onCode: (value: string) => void): Scanner {
  const [availability, setAvailability] = useState<ScanAvailability>({ kind: "ready" });
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  // The callback is held in a ref so the sampling loop never restarts because a
  // parent re-rendered with a new closure.
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  // Read once on mount: window.isSecureContext and the presence of these APIs do
  // not change while the page is open.
  useEffect(() => setAvailability(scanAvailability(scanEnvironment())), []);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  }, []);

  const start = useCallback(() => {
    if (scanAvailability(scanEnvironment()).kind !== "ready") return;
    setError("");
    setScanning(true);

    void (async () => {
      try {
        // `environment` is the rear camera. A counter phone pointed at a
        // customer's screen is the whole use case; defaulting to the selfie
        // camera would make it useless on the first try.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) {
          // The preview unmounted between the click and the permission grant.
          stream.getTracks().forEach((t) => t.stop());
          setScanning(false);
          return;
        }
        video.srcObject = stream;
        await video.play();

        const Detector = detectorCtor();
        if (!Detector) {
          stop();
          setError("This browser cannot decode QR codes.");
          return;
        }
        const detector = new Detector({ formats: ["qr_code"] });

        timerRef.current = window.setInterval(() => {
          void (async () => {
            const el = videoRef.current;
            if (!el || el.readyState < 2) return;
            try {
              const found = await detector.detect(el);
              const value = found[0]?.rawValue?.trim();
              if (!value) return;
              stop(); // exactly one code per opening — see the note above
              onCodeRef.current(value);
            } catch {
              // A frame that could not be analysed is normal (mid-focus, motion
              // blur). Swallowing it is right; the interval tries again in 140ms.
            }
          })();
        }, SAMPLE_MS);
      } catch (e) {
        stop();
        setError(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "Camera permission was refused. Type the code instead, or allow the camera in the browser's site settings."
            : "Could not open the camera. Type the code instead.",
        );
      }
    })();
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { availability, scanning, videoRef, start, stop, error };
}
