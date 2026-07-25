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

/** Wraps content that should animate in when it first appears. */
export function AppearIn({
  variant = "rise",
  delayMs = 0,
  className = "",
  children,
}: {
  variant?: "rise" | "pop";
  delayMs?: number;
  className?: string;
  children: ReactNode;
}) {
  const animation = variant === "pop" ? "animate-pop-in" : "animate-rise-in";
  return (
    <div className={`${animation} ${className}`} style={{ animationDelay: `${delayMs}ms` }}>
      {children}
    </div>
  );
}
