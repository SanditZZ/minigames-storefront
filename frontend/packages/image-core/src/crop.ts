// CALCULATIONS layer: the geometry of a crop-and-zoom editor.
//
// Every number an image cropper needs is a pure function of four things: the
// source image's size, the size of the frame it is being fitted into, the
// current zoom, and the current pan offset. None of that needs a canvas, a
// pointer event, or a DOM — so none of it lives in one.
//
// This was ported from an existing editor in a sibling project where all of it
// sat inside the component, recomputed inline in five different handlers. The
// split matters beyond tidiness: the clamping below is what stops a user
// dragging the image out of its own frame and exporting a band of blank canvas,
// and in the original that rule existed in a closure no test could reach.

/** A width/height pair, in whatever units the caller is working in. */
export interface Size {
  width: number;
  height: number;
}

/** Where the source image currently sits inside the frame. */
export interface CropView {
  /** 1 = the image exactly covers the frame; never below MIN_ZOOM. */
  zoom: number;
  /** Top-left of the rendered image relative to the frame, in frame units. */
  offsetX: number;
  offsetY: number;
}

/** Zoom bounds. 1 is "cover the frame"; 3× is as far in as dragging allows. */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

/** The identity view, used when there is no usable image to measure. */
const NO_VIEW: CropView = { zoom: MIN_ZOOM, offsetX: 0, offsetY: 0 };

export function clamp(value: number, min: number, max: number): number {
  // Ordering the bounds defensively: a degenerate frame can invert them, and
  // Math.min(max, Math.max(min, …)) would then silently return the wrong end.
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return Math.max(low, Math.min(high, value));
}

function usable(size: Size): boolean {
  return (
    Number.isFinite(size.width) &&
    Number.isFinite(size.height) &&
    size.width > 0 &&
    size.height > 0
  );
}

/**
 * The scale at which the source just covers the frame — the larger of the two
 * axis ratios, not the smaller.
 *
 * Cover rather than contain is the whole reason the editor exists: contain
 * would letterbox a portrait photo into a square frame and export the bars,
 * which is exactly the outcome an operator opens a cropper to avoid.
 */
export function coverScale(source: Size, frame: Size): number {
  if (!usable(source) || !usable(frame)) return 1;
  return Math.max(frame.width / source.width, frame.height / source.height);
}

/** How large the source renders inside the frame at a given zoom. */
export function renderedSize(source: Size, frame: Size, zoom: number): Size {
  const scale = coverScale(source, frame) * zoom;
  return { width: source.width * scale, height: source.height * scale };
}

/**
 * Pulls a pan offset back until the rendered image still covers the frame.
 *
 * The bounds are the invariant this module is for: the image's left edge may
 * never fall right of the frame's left edge (offset ≤ 0), and its right edge
 * never left of the frame's right edge (offset ≥ frame − rendered). Between
 * them, any pan is legal.
 */
export function clampOffset(view: CropView, source: Size, frame: Size): CropView {
  if (!usable(source) || !usable(frame)) return NO_VIEW;

  const rendered = renderedSize(source, frame, view.zoom);
  return {
    zoom: view.zoom,
    offsetX: clamp(view.offsetX, frame.width - rendered.width, 0),
    offsetY: clamp(view.offsetY, frame.height - rendered.height, 0),
  };
}

/** The starting view: fully zoomed out, image centred in the frame. */
export function initialView(source: Size, frame: Size): CropView {
  if (!usable(source) || !usable(frame)) return NO_VIEW;

  const rendered = renderedSize(source, frame, MIN_ZOOM);
  return {
    zoom: MIN_ZOOM,
    offsetX: (frame.width - rendered.width) / 2,
    offsetY: (frame.height - rendered.height) / 2,
  };
}

/**
 * Zooms to a new level, keeping the pan proportional and legal.
 *
 * Offsets scale by the same ratio as the zoom, which holds the frame's
 * top-left corner of the image roughly in place. It is not a true
 * zoom-about-the-centre — that would need the frame's midpoint as the fixed
 * point — but it is what the original does, and changing the feel of the
 * gesture was not part of porting it.
 */
export function zoomTo(view: CropView, nextZoom: number, source: Size, frame: Size): CropView {
  if (!usable(source) || !usable(frame)) return NO_VIEW;

  const zoom = clamp(Number.isFinite(nextZoom) ? nextZoom : MIN_ZOOM, MIN_ZOOM, MAX_ZOOM);
  const ratio = view.zoom === 0 ? 1 : zoom / view.zoom;
  return clampOffset(
    { zoom, offsetX: view.offsetX * ratio, offsetY: view.offsetY * ratio },
    source,
    frame,
  );
}

/** Pans to an absolute offset, clamped. */
export function panTo(view: CropView, offsetX: number, offsetY: number, source: Size, frame: Size): CropView {
  return clampOffset({ zoom: view.zoom, offsetX, offsetY }, source, frame);
}

/** The arguments for a drawImage onto the output canvas. */
export interface DrawRect {
  dx: number;
  dy: number;
  dWidth: number;
  dHeight: number;
}

/**
 * Maps the on-screen view onto the output canvas.
 *
 * The editor previews at a size that fits a phone and exports at whatever the
 * caller asked for, so every coordinate scales by the ratio between the two.
 * Doing this as one function is what keeps the preview and the exported file
 * showing the same crop — in the original these two calculations were written
 * out twice, in the render effect and in the apply handler, which is precisely
 * the shape of bug where what you export is not what you saw.
 */
export function exportRect(
  view: CropView,
  source: Size,
  frame: Size,
  output: Size,
): DrawRect {
  if (!usable(source) || !usable(frame) || !usable(output)) {
    return { dx: 0, dy: 0, dWidth: 0, dHeight: 0 };
  }

  const scaleX = output.width / frame.width;
  const scaleY = output.height / frame.height;
  const rendered = renderedSize(source, frame, view.zoom);

  return {
    dx: view.offsetX * scaleX,
    dy: view.offsetY * scaleY,
    dWidth: rendered.width * scaleX,
    dHeight: rendered.height * scaleY,
  };
}

/**
 * The preview frame for an output size, capped to a width that fits a phone.
 *
 * The preview must share the output's aspect ratio or the crop shown is not the
 * crop taken — a square preview of a 4:3 export would quietly trim the sides.
 */
export function frameFor(output: Size, maxWidth: number): Size {
  if (!usable(output) || maxWidth <= 0) return { width: maxWidth, height: maxWidth };

  const width = Math.min(maxWidth, output.width);
  return { width, height: Math.round(width * (output.height / output.width)) };
}
