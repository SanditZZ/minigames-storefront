import type { CSSProperties, ReactNode } from "react";

/**
 * A circular countdown wrapped around whatever it contains — normally the
 * game's main tap target.
 *
 * The point is co-location: a bar above the action is in the wrong place,
 * because the player's eyes are on the thing they are hammering, not on the
 * chrome. Draining the ring around the button puts the pressure exactly where
 * the attention already is.
 *
 * Drawn with a conic-gradient rather than SVG so there is no extra element to
 * keep in sync, and no transition — it is driven from an interval and any
 * easing would make it lag the real clock.
 */
export function RingTimer({
  pct,
  urgent = false,
  children,
}: {
  /** Remaining fraction of the round, 0–100. */
  pct: number;
  /** Emphasises the final seconds. */
  urgent?: boolean;
  children: ReactNode;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  // Ink against the coral button: the palette's only high-contrast pairing on a
  // light surface, so the remaining arc stays legible at a glance.
  const style: CSSProperties = {
    background: `conic-gradient(var(--color-ink) ${clamped}%, color-mix(in srgb, var(--color-ink) 12%, transparent) 0)`,
  };

  // Deliberately NOT aria-hidden: this wraps the game's primary control, and
  // aria-hidden on a container removes its entire subtree from the
  // accessibility tree — which would make the tap button unreachable to
  // assistive tech (and to any role-based query). The ring needs no hiding
  // anyway: it is a background gradient contributing no text of its own.
  return (
    <div
      className={`grid place-items-center rounded-full p-2.5 ${urgent ? "animate-flash" : ""}`}
      style={style}
    >
      {children}
    </div>
  );
}
