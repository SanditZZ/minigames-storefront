import type { ReactNode } from "react";

/**
 * Full-screen themed backdrop that hosts the whole player app. The warm
 * cream→apricot gradient lives here so every screen and game share one canvas.
 * Safe-area padding keeps content clear of notches and home indicators on the
 * phones this runs on in-store.
 */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-gradient-to-b from-brand-4 to-brand-3">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        {children}
      </div>
    </div>
  );
}

/** Vertically-centred column, the default layout for game/interstitial content. */
export function CenterStack({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`flex flex-1 flex-col items-center justify-center gap-6 ${className}`}>{children}</div>;
}

/** A plain vertical stack with consistent rhythm. */
export function Stack({ gap = "md", className = "", children }: { gap?: "sm" | "md" | "lg"; className?: string; children: ReactNode }) {
  const gaps = { sm: "gap-2", md: "gap-4", lg: "gap-6" } as const;
  return <div className={`flex flex-col ${gaps[gap]} ${className}`}>{children}</div>;
}

/**
 * A title/subtitle block beside an optional action.
 *
 * This encodes the project's anti-overlap rule in one place: the parent owns the
 * gap, the text block gets `min-w-0 flex-1` so long copy truncates instead of
 * shoving the button off-screen, and the action gets `shrink-0 whitespace-nowrap`
 * so it never collapses or wraps mid-label. Use it for every header-with-button.
 */
export function HeaderRow({
  title,
  subtitle,
  action,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-bold text-ink">{title}</h2>
        {subtitle != null && <p className="truncate text-sm text-ink/60">{subtitle}</p>}
      </div>
      {action != null && <div className="shrink-0 whitespace-nowrap">{action}</div>}
    </div>
  );
}
