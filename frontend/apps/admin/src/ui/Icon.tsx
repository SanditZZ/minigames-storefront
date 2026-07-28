import { ICONS, ICON_STROKE, ICON_VIEWBOX, type IconName, type IconShape } from "@minigames/icons";

/**
 * One icon from `@minigames/icons`, drawn as inline SVG.
 *
 * A deliberate copy of the player app's `ui/Icon.tsx`, not a shared import. The
 * geometry is shared — that is what `@minigames/icons` is for — but the twenty
 * lines that turn a shape list into markup are per-platform, and a package may
 * not import React. Each app's UI kit already owns its own `Button`, `Card` and
 * `Layout` on the same principle; this is one more of those.
 *
 * Sizes in `em` and paints with `currentColor`, so an icon takes the font-size
 * and the ink colour of whatever slot it lands in. `aria-hidden` by default:
 * the icon is never the accessible name — the control around it is.
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
