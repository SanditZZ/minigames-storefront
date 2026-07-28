// DATA layer: what one icon is made of, and the stroke conventions every icon
// in the table shares.
//
// An icon is a LIST OF SHAPES, not a string of SVG markup. That is the whole
// reason this is a package rather than a folder of `.svg` files or a component
// with `dangerouslySetInnerHTML`: markup is a web thing, and React Native draws
// with `react-native-svg` components instead. A `{ tag: "circle", cx, cy, r }`
// object renders as `<circle>` on the web and `<Circle>` on a phone from the
// same row, so the phone client inherits the icon set rather than re-tracing it.
//
// The tags are exactly the four Lucide uses across the icons in ./data — any
// import that needs a fifth adds it here first, which is deliberate: the union
// is what makes an app's renderer provably exhaustive.

export type IconShape =
  | { tag: "path"; d: string }
  | { tag: "circle"; cx: number; cy: number; r: number }
  | { tag: "line"; x1: number; y1: number; x2: number; y2: number }
  | {
      tag: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      rx?: number;
      ry?: number;
    };

/**
 * The coordinate space every icon in the table is drawn on.
 *
 * Shared, not per-icon: a mixed grid is what makes two icons beside each other
 * look like they came from different sets, which is the thing choosing one set
 * was meant to prevent.
 */
export const ICON_VIEWBOX = "0 0 24 24";

/**
 * Lucide's stroke geometry. These are the values the shapes were drawn for —
 * the paths are open outlines with no fill, so rendering them filled, or at a
 * weight they were not designed at, does not degrade gracefully. A renderer
 * applies all four or draws something that is not the icon.
 */
export const ICON_STROKE = {
  width: 2,
  linecap: "round",
  linejoin: "round",
} as const;
