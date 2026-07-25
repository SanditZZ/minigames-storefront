import type { ReactNode } from "react";

/**
 * The landing hero: brand wordmark, headline, and supporting line. Kept as a
 * component so the store's identity is presented identically wherever it
 * appears, and so a logo can later replace the wordmark in one edit.
 */
export function PageHeader({
  brand,
  title,
  subtitle,
}: {
  brand?: string;
  title: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <header className="text-center">
      {brand && (
        <p className="text-xs font-black uppercase tracking-[0.3em] text-ink/50">{brand}</p>
      )}
      <h1 className="mt-1 text-3xl font-black leading-tight text-ink">{title}</h1>
      {subtitle != null && <p className="mt-1 text-ink/70">{subtitle}</p>}
    </header>
  );
}
