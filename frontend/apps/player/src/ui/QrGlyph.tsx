import { encode, svgExtent, toSvgPath } from "@minigames/qr-core";

interface Props {
  /** The text to encode. Short and alphanumeric — see @minigames/qr-core. */
  value: string;
  /**
   * The accessible name. Required, like `IconButton`'s: a graphic that carries
   * the only machine-readable copy of a prize credential must not be anonymous
   * to a screen reader.
   */
  label: string;
  className?: string;
}

/**
 * A QR code as a single inline SVG path.
 *
 * Kit primitive rather than markup inside `ClaimCard`, because the admin's own
 * claim view and any future printed voucher want the identical glyph, and
 * because the two rules below are easy to get wrong once each:
 *
 * - **The light modules are painted, not left transparent.** A QR is contrast,
 *   and this card sits on `bg-brand-4` (cream) in one state and `bg-ink/5` in
 *   another. A transparent symbol would be dark-on-cream — readable by a good
 *   scanner in good light, and the sort of thing that fails at a counter at
 *   dusk. The white rect covers the quiet zone too, which is why the zone is
 *   part of the path's coordinate space rather than CSS padding.
 * - **The dark modules are `ink`, not black.** Palette rule, and it survives a
 *   store's runtime override because it reads the same custom property every
 *   other surface does. Ink on white is well past the 3:1 a scanner needs.
 *
 * `shapeRendering="crispEdges"` stops the browser antialiasing module borders
 * into grey, which is what turns a small symbol into an unreadable one.
 *
 * Renders nothing when the value cannot be encoded (see `encode`), because the
 * card always shows the code as text as well — losing the QR costs a
 * convenience, and a broken graphic would cost trust.
 */
export function QrGlyph({ value, label, className = "" }: Props) {
  const qr = encode(value);
  if (!qr) return null;

  const extent = svgExtent(qr);

  return (
    <svg
      viewBox={`0 0 ${extent} ${extent}`}
      role="img"
      aria-label={label}
      // Deliberately NOT carrying the value in a data attribute. A test that read
      // one back would prove the component was handed the right string and
      // nothing about whether the symbol it drew is scannable — which is the only
      // thing that matters here, and is why the browser suite decodes pixels.
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={extent} height={extent} fill="#fff" />
      <path d={toSvgPath(qr)} fill="var(--color-ink)" />
    </svg>
  );
}
