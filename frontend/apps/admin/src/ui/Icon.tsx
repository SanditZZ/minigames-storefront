import { ICONS, ICON_FILL, ICON_VIEWBOX, type IconName } from "@minigames/icons";

/**
 * One icon from `@minigames/icons`, drawn as inline SVG.
 *
 * A deliberate copy of the player app's `ui/Icon.tsx`, not a shared import. The
 * geometry is shared — that is what `@minigames/icons` is for — but the few
 * lines that turn a path list into markup are per-platform, and a package may
 * not import React. Each app's UI kit already owns its own `Button`, `Card` and
 * `Layout` on the same principle; this is one more of those.
 *
 * Sizes in `em` and fills with `currentColor`, so an icon takes the font-size
 * and the ink colour of whatever slot it lands in. Never stroked — Phosphor's
 * fill paths cut their negative space out of a closed outline. `aria-hidden` by
 * default: the icon is never the accessible name, the control around it is.
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
