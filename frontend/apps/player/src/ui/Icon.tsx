import { ICONS, ICON_FILL, ICON_VIEWBOX, type IconName } from "@minigames/icons";

/**
 * One icon from `@minigames/icons`, drawn as inline SVG.
 *
 * This is the whole web half of the icon system: the package holds geometry,
 * this holds the handful of lines that turn it into pixels. A React Native
 * client writes its own equivalent against `react-native-svg` and shares the
 * table — which is why the shapes are `d` strings rather than an `<svg>` blob,
 * and why nothing here is exported to a package.
 *
 * Three defaults do the work:
 *
 * - **`1em`**, not a pixel size. An icon then scales with the font-size of the
 *   box it sits in, so `text-4xl` on a card and `text-base` on a ladder rung
 *   keep meaning what they meant. Pass a `className` with explicit `h-`/`w-`
 *   where a slot needs a fixed size.
 * - **Filled with `currentColor`, never stroked.** An icon inherits the ink or
 *   brand colour of its context, so a store's runtime palette override reaches
 *   it. Phosphor's fill paths are closed outlines with the negative space cut
 *   out, so stroking one would draw an outline around the holes as well.
 * - **`aria-hidden`**, because that is what an icon almost always is here:
 *   decoration beside copy that already carries the meaning. The exception is a
 *   control whose only content is the icon; that gets its name from the button
 *   (see `IconButton`'s `label`), never from the glyph.
 */
export function Icon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox={ICON_VIEWBOX}
      width="1em"
      height="1em"
      fill={ICON_FILL}
      className={className}
      aria-hidden
    >
      {ICONS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
