import type { ReactNode } from "react";

/**
 * Full-screen themed backdrop that hosts the whole player app. The warm
 * cream→apricot gradient lives here so every screen and game share one canvas.
 * Safe-area padding keeps content clear of notches and home indicators on the
 * phones this runs on in-store.
 *
 * `banner` is the store's cover image (StoreBanner), and it is a slot here
 * rather than markup inside a screen because it has to escape the padded column
 * — a cover that stops short of the edges is a card, not a cover. It sits
 * OUTSIDE the padding and above everything, so the image reaches the top of the
 * viewport and runs under a notch the way a cover photo should.
 *
 * When a banner is present the column drops its top safe-area padding: the
 * banner has already cleared the notch, and keeping it would leave a band of
 * dead gradient under an image that fades into that same colour. Passing null —
 * which is what an unset banner resolves to — restores it. The caller decides,
 * because only the caller knows whether the store actually has one.
 *
 * `wide` drops the phone-width cap for the one screen that isn't phone-shaped:
 * the TV/kiosk display (see DisplayScreen). It keeps the same gradient and
 * safe-area handling — a TV has no notch, but the extra padding at that scale
 * reads as generous rather than wrong — rather than that screen rolling its
 * own backdrop.
 */
export function Screen({
  banner,
  wide = false,
  children,
}: {
  banner?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-h-full bg-gradient-to-b from-brand-4 to-brand-3">
      <div className={`mx-auto flex min-h-dvh flex-col ${wide ? "max-w-none" : "max-w-md"}`}>
        {banner}
        <div
          className={`flex flex-1 flex-col gap-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] ${
            wide ? "px-8 sm:px-16" : "px-5"
          } ${banner ? "pt-4" : "pt-[max(1.25rem,env(safe-area-inset-top))]"}`}
        >
          {children}
        </div>
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
