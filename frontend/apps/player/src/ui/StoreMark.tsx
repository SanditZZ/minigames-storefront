/**
 * The store's mark: its logo when it has one, its name set as a wordmark when it
 * does not.
 *
 * Extracted from PageHeader the moment a second screen wanted it. The rule it
 * carries is the reason it is one component rather than two call sites: a logo
 * renders SQUARE — a fixed box, cropped to fill — because a store's upload can
 * be any aspect ratio, and a free one pushes the content below it down the
 * screen by a different amount for every store. Get that wrong in one of two
 * copies and two screens disagree about how tall a store is.
 *
 * Square rather than height-capped-and-width-free, which is what this was: both
 * a wide wordmark and a square badge were accepted, and the mark had to be the
 * store's whole visual identity because it was the only image on the screen. It
 * is not any more — a wide image now has StoreBanner, which is the shape a wide
 * image was reaching for.
 *
 * `object-cover`, not `object-contain`: the box is always filled rather than
 * letterboxing a wide mark into a stripe floating in empty space. The cost is
 * that a wide upload is cropped to its centre, which is why the admin's logo
 * field exports 1:1 — the operator frames it, so what they see is what renders.
 *
 * `name` is required even when a logo is present — it becomes the image's alt
 * text, so the store is named for a screen reader and for anyone whose logo
 * fails to load.
 */
export function StoreMark({
  name,
  logoUrl,
  size = "lg",
}: {
  name: string;
  /** Absolute URL of the store's logo, or "" when there is none. */
  logoUrl?: string;
  /**
   * `lg` is the landing hero; `sm` is a credit above other content, where the
   * store is context rather than the subject. Two sizes rather than a free
   * class, so a third slot has to pick a side instead of inventing a height.
   */
  size?: "lg" | "sm";
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className={`mx-auto aspect-square rounded-2xl object-cover ${size === "lg" ? "size-16" : "size-10"}`}
      />
    );
  }

  // `max-w-full` is load-bearing, not belt-and-braces: `truncate` sets
  // `white-space: nowrap`, which makes this element's min-content width the
  // whole store name — so as a bare flex item it would size to the text and
  // overflow a 320px screen rather than ellipsing. The landing header hands it
  // a `min-w-0 flex-1` parent that already clamps it; the result screen stacks
  // it directly, and a mark that truncates on one screen and overflows on the
  // other is exactly what pulling this into the kit is supposed to prevent.
  return (
    <p className="max-w-full truncate text-center text-xs font-black uppercase tracking-[0.3em] text-ink/50">
      {name}
    </p>
  );
}
