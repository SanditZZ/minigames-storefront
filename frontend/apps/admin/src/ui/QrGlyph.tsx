import { encodeText, svgExtent, toSvgPath } from "@minigames/qr-core";

interface Props {
  /** The text to encode — the admin's one use is a display URL, so this goes
   *  through `encodeText` (byte mode, up to version 6), not `encode`: a URL is
   *  mixed-case and longer than the ten alphanumeric characters that one holds. */
  value: string;
  /** The accessible name. Required — a graphic is anonymous to a screen reader otherwise. */
  label: string;
  className?: string;
}

/**
 * A QR code as a single inline SVG path.
 *
 * Shaped like the player app's `QrGlyph` (`apps/player/src/ui/QrGlyph.tsx`) —
 * same rendering, same reason it isn't imported instead (a package may not
 * import React, so each app owns the handful of lines that turn
 * `@minigames/qr-core`'s data into markup, same as `Icon.tsx`) — but built on
 * `encodeText` rather than `encode`, because the admin's payload is a URL
 * rather than a short claim code.
 */
export function QrGlyph({ value, label, className = "" }: Props) {
  const qr = encodeText(value);
  if (!qr) return null;

  const extent = svgExtent(qr);

  return (
    <svg
      viewBox={`0 0 ${extent} ${extent}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={extent} height={extent} fill="#fff" />
      <path d={toSvgPath(qr)} fill="var(--color-ink)" />
    </svg>
  );
}
