import type { ReactNode } from "react";
import { StoreMark } from "./StoreMark";

/**
 * The landing hero: the store's mark, a headline, and a supporting line.
 *
 * The mark itself is StoreMark, which the result screen also renders — this
 * header is the hero arrangement around it, not the only place a store is
 * named.
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
  logoUrl,
  title,
  subtitle,
  action,
}: {
  brand?: string;
  /** The store's logo, shown INSTEAD of the wordmark — see StoreMark. */
  logoUrl?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  const hero = (
    <div className="min-w-0 flex-1 text-center">
      {(logoUrl || brand) && <StoreMark name={brand ?? ""} logoUrl={logoUrl} />}
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
