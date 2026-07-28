import type { CSSProperties, ReactNode } from "react";

/**
 * Celebration confetti.
 *
 * Particles are laid out from a fixed spread rather than random values so the
 * burst looks identical every time and never re-randomises on re-render. Purely
 * decorative, so it is hidden from assistive tech; the global reduce-motion rule
 * in index.css neutralises it for players who asked for less movement.
 */
export function Confetti({ count = 14, className = "" }: { count?: number; className?: string }) {
  const pieces = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const distance = 90 + (i % 4) * 26;
    return {
      key: i,
      style: {
        "--dx": `${Math.cos(angle) * distance}px`,
        "--dy": `${Math.sin(angle) * distance + 120}px`,
        "--spin": `${(i % 2 ? 1 : -1) * (180 + i * 24)}deg`,
        animationDelay: `${(i % 5) * 70}ms`,
      } as CSSProperties,
      tone: ["bg-brand", "bg-brand-2", "bg-brand-3", "bg-ink/70"][i % 4],
    };
  });

  return (
    <div className={`pointer-events-none absolute inset-0 grid place-items-center ${className}`} aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.key}
          style={p.style}
          className={`absolute h-2.5 w-2 rounded-[2px] animate-confetti ${p.tone}`}
        />
      ))}
    </div>
  );
}

/**
 * Expanding rings behind a focal element — the "something just happened" cue.
 *
 * Sized to stay inside its container as it expands, so the rings never sweep
 * across neighbouring text. Give it a bounded parent (see HaloBox).
 */
export function Halo({ className = "" }: { className?: string }) {
  return (
    <span className={`pointer-events-none absolute inset-0 grid place-items-center ${className}`} aria-hidden>
      {[0, 600, 1200].map((delay) => (
        <span
          key={delay}
          style={{ animationDelay: `${delay}ms` }}
          className="absolute h-20 w-20 rounded-full border-4 border-brand animate-halo"
        />
      ))}
    </span>
  );
}

/**
 * A fixed-size stage for a focal element with rings behind it. The fixed box is
 * the point: it reserves the space the animation needs, so an expanding ring
 * can never overlap the copy underneath.
 */
export function HaloBox({ children }: { children: ReactNode }) {
  return (
    <div className="relative grid h-40 w-40 place-items-center">
      <Halo />
      {children}
    </div>
  );
}

/**
 * Transient "+1" marks lifting away from a tap.
 *
 * The caller owns the list and drops each entry when its animation is over, so
 * this stays presentational. Purely decorative and aria-hidden — the running
 * count is already announced by the Stat readout, and a screen reader does not
 * need one announcement per tap.
 *
 * Rendered as a sibling of the tap target rather than inside it, so these never
 * become part of the button's accessible name.
 */
export function TapMarks({ marks, label = "+1" }: { marks: { id: number; x: number }[]; label?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      {marks.map((m) => (
        <span
          key={m.id}
          style={{ left: `${m.x}%`, "--drift": `${(m.id % 5) * 8 - 16}px` } as CSSProperties}
          className="animate-float-up absolute top-1/3 text-2xl font-black text-ink"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

/**
 * Wraps content that should animate in when it first appears.
 *
 * `riseSolid` is `rise` with the fade removed, for a subtree that has to be
 * READABLE while it arrives — today that is the claim card, whose QR a camera
 * cannot decode at partial opacity. It is a variant here rather than a prop on
 * the thing that needs it because opacity inherits down: nothing inside an
 * animated ancestor can opt out of the ancestor's fade, so the exemption can
 * only be made at this level.
 */
export function AppearIn({
  variant = "rise",
  delayMs = 0,
  className = "",
  children,
}: {
  variant?: "rise" | "riseSolid" | "pop";
  delayMs?: number;
  className?: string;
  children: ReactNode;
}) {
  const animation = ANIMATION[variant];
  return (
    <div className={`${animation} ${className}`} style={{ animationDelay: `${delayMs}ms` }}>
      {children}
    </div>
  );
}

/** Written out rather than interpolated: Tailwind only emits a class it can see. */
const ANIMATION: Record<"rise" | "riseSolid" | "pop", string> = {
  rise: "animate-rise-in",
  riseSolid: "animate-rise-solid",
  pop: "animate-pop-in",
};
