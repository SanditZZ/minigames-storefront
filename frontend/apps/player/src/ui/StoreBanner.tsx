/**
 * The store's cover image: a wide band across the top of the app, in the shape
 * everyone already understands from a social profile's cover.
 *
 * A separate image from StoreMark, not a second render of it. The mark says who
 * the shop is and the cover says what it feels like, and one file cropped to
 * serve both is wrong in one of the two places — a wide photograph makes a poor
 * square badge, and a square badge stretched across the top is a logo with a lot
 * of dead space beside it.
 *
 * ## It replaces the top of the gradient rather than sitting on top of it
 *
 * Every screen shares one canvas — `from-brand-4 to-brand-3`, owned by `Screen`
 * — and a banner is a second background arriving in the same place. Two
 * backgrounds fighting is the failure mode, so this resolves it in one
 * direction: the image occupies the top of the canvas and FADES into it, with
 * the overlay's end colour being `brand-4` because that is what the gradient
 * starts as. There is no seam to align, and re-theming the palette moves the
 * fade with it — the overlay names the token, not a hex value.
 *
 * ## Unset renders nothing
 *
 * `bannerUrl` of "" returns null rather than a grey placeholder box: an
 * unconfigured storefront should look clean, not unfinished. That is the same
 * rule the missing logo already follows, and it is the reason `Screen` decides
 * its top padding from whether a banner was passed rather than from the route.
 *
 * ## It carries no accessible name
 *
 * `alt=""` and the image is decoration. Everything a banner might be captioned
 * with — the store's name, its tagline — is already text in the header directly
 * below it, so describing it would make a screen reader announce the shop twice.
 * An operator's photograph is also the one thing here nobody can write alt text
 * for: it is chosen after this code ships.
 */
export function StoreBanner({ url }: { url: string }) {
  if (!url) return null;

  return (
    <div className="relative isolate aspect-[3/1] w-full overflow-hidden">
      <img src={url} alt="" className="size-full object-cover" />
      {/* The fade, as its own element rather than a gradient on the image, so
          the image is never re-encoded or masked — only covered. `to-brand-4`
          is the gradient's own first stop, which is what makes the seam
          invisible without either side knowing the other's geometry. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-brand-4"
      />
    </div>
  );
}
