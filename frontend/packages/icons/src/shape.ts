// DATA layer: what one icon is, and the one coordinate space they all share.
//
// An icon is a LIST OF PATHS, not a string of SVG markup. That is the whole
// reason this is a package rather than a folder of `.svg` files or a component
// with `dangerouslySetInnerHTML`: markup is a web thing, and React Native draws
// with `react-native-svg` components instead. A `d` string renders as `<path>`
// on the web and `<Path>` on a phone from the same row, so a native client
// inherits the icon set rather than re-tracing it.

/**
 * The paths that make up one icon, in draw order.
 *
 * Paths only — no circles, rects or lines. That is not a simplification of
 * Phosphor's fill weight, it is what the fill weight IS: a solid icon is
 * authored as flattened outlines, so every icon in ./data is one or two `d`
 * strings and nothing else. Should a future addition need another primitive,
 * this type widens to a union and both apps' renderers gain a branch; until one
 * does, a union would be four cases where the data only ever takes one.
 */
export type IconPaths = readonly string[];

/**
 * The coordinate space every icon in the table is drawn on.
 *
 * Shared, not per-icon: a mixed grid is what makes two icons beside each other
 * look like they came from different sets, which is the thing choosing one set
 * was meant to prevent. Phosphor draws on 256; Lucide, which this replaced,
 * drew on 24 — so this constant is exactly the kind of value that must not be
 * spelled out at a call site.
 */
export const ICON_VIEWBOX = "0 0 256 256";

/**
 * How a filled icon paints: solid `currentColor`, no stroke at all.
 *
 * Worth stating rather than leaving implicit in each renderer, because it is
 * the property that decides whether the set looks like itself. Phosphor's fill
 * paths are closed outlines with the negative space cut out of them — stroking
 * one outlines the hole as well, and filling a stroke-authored set (Lucide's,
 * say) turns an open outline into a blob. A set is drawn for exactly one of
 * these two treatments and does not survive the other.
 */
export const ICON_FILL = "currentColor";
