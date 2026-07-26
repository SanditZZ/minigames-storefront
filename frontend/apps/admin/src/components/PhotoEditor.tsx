import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  type CropView,
  type Size,
  exportRect,
  frameFor,
  initialView,
  panTo,
  renderedSize,
  zoomTo,
} from "@minigames/image-core";
import { Button } from "../ui";

/**
 * Crop, zoom and re-encode an image before it is uploaded.
 *
 * Ported from an editor in a sibling project, with the geometry lifted out into
 * @minigames/image-core — everything left here is canvas and pointer handling,
 * which is the half that has to be written again for a native client anyway.
 *
 * It earns its place beyond framing: re-encoding to a bounded output size is
 * what stops `blob.MaxUploadBytes` (2 MiB) rejecting a photo taken on a modern
 * phone, so the cap becomes something the operator never has to know about.
 */
export function PhotoEditor({
  file,
  output,
  format = "image/jpeg",
  onConfirm,
  onCancel,
}: {
  file: File;
  /** Exported pixel dimensions. The preview matches this aspect ratio. */
  output: Size;
  /**
   * Encoded output type. JPEG for photographs; PNG for anything that needs
   * transparency, which a store logo usually does — a transparent PNG
   * re-encoded as JPEG comes back with a solid background.
   */
  format?: "image/jpeg" | "image/png";
  onConfirm: (file: File) => void;
  onCancel: () => void;
}) {
  const frame = frameFor(output, 260);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cropRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [source, setSource] = useState<Size | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<CropView>({ zoom: MIN_ZOOM, offsetX: 0, offsetY: 0 });
  const [dragging, setDragging] = useState(false);

  // Gesture state the render does not depend on. Refs rather than state so a
  // pointer move does not re-render before the frame it is about to draw.
  const dragFrom = useRef<{ x: number; y: number; view: CropView } | null>(null);
  const pinchFrom = useRef<number | null>(null);
  const latest = useRef(view);
  latest.current = view;

  // --- Load ----------------------------------------------------------------

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const size = { width: img.naturalWidth, height: img.naturalHeight };
      imgRef.current = img;
      setSource(size);
      setView(initialView(size, frame));
    };
    img.onerror = () => setFailed(true);
    img.src = url;

    return () => URL.revokeObjectURL(url);
    // frame is derived from `output`, which is stable for a given open editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // --- Preview -------------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !source) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rendered = renderedSize(source, frame, view.zoom);
    ctx.clearRect(0, 0, frame.width, frame.height);
    ctx.drawImage(img, view.offsetX, view.offsetY, rendered.width, rendered.height);
  }, [view, source, frame]);

  // A touch-drag inside the crop window must not scroll the page behind it.
  // This has to be a non-passive listener, which React's onTouchMove cannot be.
  useEffect(() => {
    const el = cropRef.current;
    if (!el) return;
    const swallow = (e: Event) => e.preventDefault();
    el.addEventListener("touchmove", swallow, { passive: false });
    return () => el.removeEventListener("touchmove", swallow);
  }, []);

  // Escape closes it, as it does for any modal — this one covers the screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // --- Gestures ------------------------------------------------------------

  const pan = useCallback(
    (x: number, y: number) => {
      const from = dragFrom.current;
      if (!from || !source) return;
      setView(panTo(from.view, from.view.offsetX + x - from.x, from.view.offsetY + y - from.y, source, frame));
    },
    [source, frame],
  );

  const zoom = useCallback(
    (next: number) => {
      if (!source) return;
      setView(zoomTo(latest.current, next, source, frame));
    },
    [source, frame],
  );

  const startDrag = (x: number, y: number) => {
    dragFrom.current = { x, y, view: latest.current };
    setDragging(true);
  };
  const endDrag = () => {
    dragFrom.current = null;
    setDragging(false);
  };

  const pinchDistance = (touches: React.TouchList) =>
    Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY,
    );

  // --- Export --------------------------------------------------------------

  function apply() {
    const img = imgRef.current;
    if (!img || !source) return;

    const canvas = document.createElement("canvas");
    canvas.width = output.width;
    canvas.height = output.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // JPEG has no alpha: without this, a transparent source exports with a
    // black background rather than the white one anyone would expect.
    if (format === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, output.width, output.height);
    }

    const rect = exportRect(view, source, frame, output);
    ctx.drawImage(img, rect.dx, rect.dy, rect.dWidth, rect.dHeight);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const ext = format === "image/png" ? "png" : "jpg";
        onConfirm(new File([blob], `image.${ext}`, { type: format }));
      },
      format,
      0.9,
    );
  }

  const ready = source !== null && !failed;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Crop image"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 px-4"
      onClick={onCancel}
    >
      <div
        className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-ink">Crop image</h2>

        <div
          ref={cropRef}
          // The source component also offered a circular crop window for
          // avatars. Dropped rather than carried: nothing in this app is round,
          // and an unused mode is a prop everyone has to read past.
          className="relative select-none overflow-hidden rounded-xl bg-brand-4"
          style={{
            width: frame.width,
            height: frame.height,
            cursor: dragging ? "grabbing" : "grab",
            touchAction: "none",
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            startDrag(e.clientX, e.clientY);
          }}
          onMouseMove={(e) => dragging && pan(e.clientX, e.clientY)}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onWheel={(e) => zoom(latest.current.zoom - e.deltaY * 0.001)}
          onTouchStart={(e) => {
            if (e.touches.length === 1) {
              startDrag(e.touches[0].clientX, e.touches[0].clientY);
              pinchFrom.current = null;
            } else if (e.touches.length === 2) {
              dragFrom.current = null;
              pinchFrom.current = pinchDistance(e.touches);
            }
          }}
          onTouchMove={(e) => {
            if (e.touches.length === 1 && dragFrom.current) {
              pan(e.touches[0].clientX, e.touches[0].clientY);
            } else if (e.touches.length === 2 && pinchFrom.current !== null) {
              const now = pinchDistance(e.touches);
              zoom(latest.current.zoom * (now / pinchFrom.current));
              pinchFrom.current = now;
            }
          }}
          onTouchEnd={(e) => {
            pinchFrom.current = null;
            // Lifting one finger of a pinch leaves the other still on screen —
            // restart the drag from where it is, or the image jumps.
            if (e.touches.length === 1) {
              startDrag(e.touches[0].clientX, e.touches[0].clientY);
            } else {
              endDrag();
            }
          }}
        >
          <canvas
            ref={canvasRef}
            width={frame.width}
            height={frame.height}
            className="block"
            style={{ width: frame.width, height: frame.height }}
          />
          {!ready && (
            <div className="absolute inset-0 grid place-items-center bg-brand-4 px-3 text-center text-xs text-ink/70">
              {failed ? "Could not read that image. Try a PNG or JPEG." : "Loading…"}
            </div>
          )}
        </div>

        <label className="flex w-full items-center gap-3">
          <span aria-hidden className="w-4 text-center text-ink/50">
            −
          </span>
          <input
            type="range"
            aria-label="Zoom"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={view.zoom}
            disabled={!ready}
            onChange={(e) => zoom(Number(e.target.value))}
            className="min-w-0 flex-1 accent-brand"
          />
          <span aria-hidden className="w-4 text-center text-ink/50">
            +
          </span>
        </label>

        <p className="text-center text-xs text-ink/50">
          Drag to reposition, pinch or scroll to zoom. Exports at {output.width}×{output.height}.
        </p>

        <div className="flex w-full gap-3">
          <Button variant="ghost" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={!ready} onClick={apply}>
            {failed ? "Can’t use this file" : ready ? "Use image" : "Loading…"}
          </Button>
        </div>
      </div>
    </div>
  );
}
