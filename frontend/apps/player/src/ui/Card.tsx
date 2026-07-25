import type { ReactNode } from "react";
import { PrizeImage } from "./PrizeImage";

type Tone = "solid" | "muted" | "accent";

const tones: Record<Tone, string> = {
  solid: "bg-white text-ink shadow-xl",
  muted: "bg-white/60 text-ink ring-1 ring-ink/5",
  accent: "bg-brand-4 text-ink ring-1 ring-brand/40",
};

/** A content surface. `tone` picks the emphasis; all of them carry ink text
 *  per the palette rules — never white text on the pastels. */
export function Card({
  tone = "solid",
  className = "",
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return <div className={`rounded-2xl p-4 ${tones[tone]} ${className}`}>{children}</div>;
}

/** A card with a heading — the standard titled section (leaderboard, prize). */
export function Panel({
  title,
  tone = "muted",
  className = "",
  children,
}: {
  title: ReactNode;
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card tone={tone} className={className}>
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink/70">{title}</h3>
      {children}
    </Card>
  );
}

/**
 * A centred, icon-led card for the one thing a screen is really about — the
 * prize won, or the consolation when there isn't one. Both states share this
 * shape so the layout doesn't jump depending on the outcome.
 *
 * `imageUrl` upgrades the emoji to the actual prize photo. It is optional
 * because only some of what this card shows is a prize with a picture — and
 * because an award can be deleted after the round, which loses the image while
 * the name survives as a snapshot. `icon` therefore stays required: it is the
 * fallback, not the alternative.
 */
export function HighlightCard({
  icon,
  imageUrl,
  eyebrow,
  title,
  body,
  note,
  tone = "solid",
  className = "",
}: {
  icon: string;
  imageUrl?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  /** Boxed footnote, e.g. how to claim the prize. */
  note?: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <Card tone={tone} className={`w-full max-w-sm text-center ${className}`}>
      {imageUrl ? (
        <PrizeImage src={imageUrl} fallback={icon} size="lg" className="mx-auto" />
      ) : (
        <div className="text-4xl" aria-hidden>
          {icon}
        </div>
      )}
      {eyebrow != null && (
        <div className="mt-2 text-sm font-semibold uppercase tracking-wide text-brand">{eyebrow}</div>
      )}
      <div className="mt-1 text-2xl font-black text-ink">{title}</div>
      {body != null && <p className="mt-2 text-sm text-ink/60">{body}</p>}
      {note != null && (
        <p className="mt-4 rounded-lg bg-brand-4 px-3 py-2 text-xs font-medium text-ink">{note}</p>
      )}
    </Card>
  );
}

/** Small all-caps label above a value or section. */
export function Eyebrow({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`text-sm font-medium uppercase tracking-widest text-ink/60 ${className}`}>{children}</div>
  );
}
