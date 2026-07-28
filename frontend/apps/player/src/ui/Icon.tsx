import { ICONS, ICON_STROKE, ICON_VIEWBOX, type IconName, type IconShape } from "@minigames/icons";

/**
 * One icon from `@minigames/icons`, drawn as inline SVG.
 *
 * This is the whole web half of the icon system: the package holds geometry,
 * this holds the four lines of markup that turn it into pixels. A React Native
 * client writes its own twenty-line equivalent against `react-native-svg` and
 * shares the table — which is why the shapes are objects rather than an `<svg>`
 * string, and why nothing here is exported to a package.
 *
 * Two defaults do most of the work:
 *
 * - **`1em`**, not a pixel size. An icon then scales with the font-size of the
 *   box it sits in, exactly as the emoji it replaced did, so `text-4xl` on a
 *   card and `text-base` on a ladder rung keep meaning what they meant. Pass a
 *   `className` with explicit `h-`/`w-` where a slot needs a fixed size.
 * - **`currentColor`**, which is the thing emoji could never do: an icon
 *   inherits the ink or brand colour of its context, so a store's runtime
 *   palette override reaches it. Emoji were the only marks on screen it could
 *   not repaint.
 *
 * `aria-hidden` is the default because that is what an icon almost always is
 * here — decoration beside copy that already carries the meaning. The exception
 * is a control whose only content is the icon; that gets its name from the
 * button (see `IconButton`'s `label`), never from the glyph.
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
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_STROKE.width}
      strokeLinecap={ICON_STROKE.linecap}
      strokeLinejoin={ICON_STROKE.linejoin}
      className={className}
      aria-hidden
    >
      {ICONS[name].map((shape, i) => (
        <Shape key={i} shape={shape} />
      ))}
    </svg>
  );
}

/** One primitive. The switch is exhaustive over `IconShape` by construction —
 *  adding a tag to the union without adding it here fails the typecheck. */
function Shape({ shape }: { shape: IconShape }) {
  switch (shape.tag) {
    case "path":
      return <path d={shape.d} />;
    case "circle":
      return <circle cx={shape.cx} cy={shape.cy} r={shape.r} />;
    case "line":
      return <line x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} />;
    case "rect":
      return (
        <rect
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={shape.height}
          rx={shape.rx}
          ry={shape.ry}
        />
      );
  }
}
