import type { ReactNode } from "react";

/**
 * The landing hero: brand wordmark, headline, and supporting line. Kept as a
 * component so the store's identity is presented identically wherever it
 * appears, and so a logo can later replace the wordmark in one edit.
 *
 * `action` is an optional control beside the hero (the settings refresh, today).
 * It is laid out as a three-part row — spacer, hero, action — rather than an
 * absolutely-positioned button: the spacer mirrors the action's width so the
 * centred hero stays optically centred, and the hero keeps `min-w-0` so a long
 * store name truncates instead of shoving the button off a 320px screen. That
 * is the same anti-overlap rule HeaderRow encodes, applied to a centred header.
 */
export function PageHeader({
  brand,
  title,
  subtitle,
  action,
}: {
  brand?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  const hero = (
    <div className="min-w-0 flex-1 text-center">
      {brand && (
        <p className="truncate text-xs font-black uppercase tracking-[0.3em] text-ink/50">{brand}</p>
      )}
      <h1 className="mt-1 text-3xl font-black leading-tight text-ink">{title}</h1>
      {subtitle != null && <p className="mt-1 text-ink/70">{subtitle}</p>}
    </div>
  );

  if (action == null) return <header className="text-center">{hero}</header>;

  return (
    <header className="flex items-start gap-3">
      <div aria-hidden className="w-11 shrink-0" />
      {hero}
      <div className="shrink-0 whitespace-nowrap">{action}</div>
    </header>
  );
}
