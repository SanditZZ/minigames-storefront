import { describe, expect, it } from "vitest";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  clampOffset,
  coverScale,
  exportRect,
  frameFor,
  initialView,
  panTo,
  renderedSize,
  zoomTo,
} from "./crop";

const square = { width: 300, height: 300 };
const landscape = { width: 400, height: 200 }; // 2:1
const portrait = { width: 200, height: 400 }; // 1:2

describe("coverScale", () => {
  // Cover, not contain: contain would letterbox a portrait photo into a square
  // frame and export the bars, which is what a cropper exists to avoid.
  it("takes the larger axis ratio so the frame is always filled", () => {
    // Portrait into a square frame: width is the tight axis (300/200 = 1.5).
    expect(coverScale(portrait, square)).toBe(1.5);
    // Landscape into a square frame: height is tight (300/200 = 1.5).
    expect(coverScale(landscape, square)).toBe(1.5);
  });

  it("is 1 for a source already the size of the frame", () => {
    expect(coverScale(square, square)).toBe(1);
  });

  // A broken image reports naturalWidth 0; without this every downstream
  // number becomes Infinity or NaN and the canvas silently renders nothing.
  it("degrades to 1 rather than dividing by zero", () => {
    expect(coverScale({ width: 0, height: 0 }, square)).toBe(1);
    expect(coverScale(square, { width: 0, height: 0 })).toBe(1);
    expect(coverScale({ width: NaN, height: 10 }, square)).toBe(1);
  });
});

describe("initialView", () => {
  it("starts zoomed out with the image centred", () => {
    const view = initialView(portrait, square);
    expect(view.zoom).toBe(MIN_ZOOM);
    // Rendered 300×600 in a 300×300 frame: no horizontal slack, 150px above.
    expect(view.offsetX).toBe(0);
    expect(view.offsetY).toBe(-150);
  });

  it("centres the other axis for a landscape source", () => {
    const view = initialView(landscape, square);
    expect(view.offsetX).toBe(-150);
    expect(view.offsetY).toBe(0);
  });
});

describe("clampOffset — the invariant this module exists for", () => {
  // Drag far enough and the frame would show blank canvas beside the image.
  // Every gesture routes through here so that is unreachable.
  it("never lets the image's edge come inside the frame", () => {
    const view = { zoom: 1, offsetX: 500, offsetY: 500 };
    const clamped = clampOffset(view, portrait, square);

    expect(clamped.offsetX).toBeLessThanOrEqual(0);
    expect(clamped.offsetY).toBeLessThanOrEqual(0);

    const rendered = renderedSize(portrait, square, 1);
    expect(clamped.offsetX + rendered.width).toBeGreaterThanOrEqual(square.width);
    expect(clamped.offsetY + rendered.height).toBeGreaterThanOrEqual(square.height);
  });

  it("clamps the far edge too, not just the near one", () => {
    const clamped = clampOffset({ zoom: 1, offsetX: -9999, offsetY: -9999 }, portrait, square);
    const rendered = renderedSize(portrait, square, 1);

    expect(clamped.offsetX).toBe(square.width - rendered.width);
    expect(clamped.offsetY).toBe(square.height - rendered.height);
  });

  it("leaves a legal pan untouched", () => {
    const view = { zoom: 1, offsetX: 0, offsetY: -100 };
    expect(clampOffset(view, portrait, square)).toEqual(view);
  });

  it("keeps an axis with no slack pinned at zero", () => {
    // Portrait at zoom 1 in a square frame renders exactly 300 wide.
    expect(clampOffset({ zoom: 1, offsetX: 40, offsetY: 0 }, portrait, square).offsetX).toBe(0);
    expect(clampOffset({ zoom: 1, offsetX: -40, offsetY: 0 }, portrait, square).offsetX).toBe(0);
  });
});

describe("zoomTo", () => {
  it("holds the zoom inside its bounds", () => {
    expect(zoomTo(initialView(square, square), 99, square, square).zoom).toBe(MAX_ZOOM);
    expect(zoomTo(initialView(square, square), 0.1, square, square).zoom).toBe(MIN_ZOOM);
    expect(zoomTo(initialView(square, square), NaN, square, square).zoom).toBe(MIN_ZOOM);
  });

  // Zooming out from a panned position would otherwise leave the offsets where
  // they were and expose an edge — the clamp is not optional here.
  it("re-clamps the pan after a zoom change", () => {
    const zoomedIn = zoomTo(initialView(portrait, square), 3, portrait, square);
    const panned = panTo(zoomedIn, -400, -800, portrait, square);
    const backOut = zoomTo(panned, 1, portrait, square);

    const rendered = renderedSize(portrait, square, 1);
    expect(backOut.offsetX).toBeGreaterThanOrEqual(square.width - rendered.width);
    expect(backOut.offsetX).toBeLessThanOrEqual(0);
    expect(backOut.offsetY).toBeGreaterThanOrEqual(square.height - rendered.height);
    expect(backOut.offsetY).toBeLessThanOrEqual(0);
  });
});

describe("exportRect", () => {
  // The bug this shape prevents: the preview and the export computing their own
  // geometry, so what an operator sees is not what the file contains.
  it("scales the previewed view onto a larger output canvas", () => {
    const frame = { width: 260, height: 260 };
    const output = { width: 520, height: 520 }; // exactly 2×
    const view = { zoom: 1, offsetX: -30, offsetY: 0 };

    const rect = exportRect(view, landscape, frame, output);
    const rendered = renderedSize(landscape, frame, 1);

    expect(rect.dx).toBe(-60);
    expect(rect.dy).toBe(0);
    expect(rect.dWidth).toBe(rendered.width * 2);
    expect(rect.dHeight).toBe(rendered.height * 2);
  });

  it("still covers the output at the extremes of a legal pan", () => {
    const frame = { width: 260, height: 195 };
    const output = { width: 800, height: 600 };
    const view = clampOffset({ zoom: 2, offsetX: -9999, offsetY: -9999 }, portrait, frame);

    const rect = exportRect(view, portrait, frame, output);
    expect(rect.dx).toBeLessThanOrEqual(0);
    expect(rect.dy).toBeLessThanOrEqual(0);
    expect(rect.dx + rect.dWidth).toBeGreaterThanOrEqual(output.width - 0.001);
    expect(rect.dy + rect.dHeight).toBeGreaterThanOrEqual(output.height - 0.001);
  });

  it("returns an empty rect for an unmeasurable image instead of NaN", () => {
    const rect = exportRect({ zoom: 1, offsetX: 0, offsetY: 0 }, { width: 0, height: 0 }, square, square);
    expect(rect).toEqual({ dx: 0, dy: 0, dWidth: 0, dHeight: 0 });
  });
});

describe("frameFor", () => {
  // A square preview of a 4:3 export would quietly trim the sides: the crop
  // shown would not be the crop taken.
  it("matches the output's aspect ratio", () => {
    expect(frameFor({ width: 800, height: 600 }, 260)).toEqual({ width: 260, height: 195 });
    expect(frameFor({ width: 512, height: 512 }, 260)).toEqual({ width: 260, height: 260 });
  });

  it("never upscales past the output's own width", () => {
    expect(frameFor({ width: 100, height: 100 }, 260)).toEqual({ width: 100, height: 100 });
  });
});
