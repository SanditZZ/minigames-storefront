// CALCULATIONS layer: the web app manifest as a plain value. No I/O.

/**
 * Builds the manifest for one app.
 *
 * `theme_color` is cream for BOTH apps, not each app's icon colour. It paints
 * the phone's status bar, and both apps open on the same `from-brand-4`
 * gradient — so cream continues the page instead of drawing a coloured band
 * across the top of it. The two apps are told apart by their icon, which is the
 * thing a user actually picks from a home screen.
 *
 * `display: standalone` rather than `fullscreen`: a kiosk phone still needs the
 * system clock and battery visible, and fullscreen hides them.
 */
export function manifest(theme, { orientation } = {}) {
  return {
    id: "/",
    name: theme.name,
    short_name: theme.shortName,
    description: theme.description,
    lang: "en",
    start_url: "/",
    scope: "/",
    display: "standalone",
    ...(orientation ? { orientation } : {}),
    background_color: "#FFF0BE",
    theme_color: "#FFF0BE",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Kept a separate entry rather than `purpose: "any maskable"`: one file
      // claiming both makes a launcher that masks it crop a glyph sized for an
      // unmasked square. The maskable render is drawn smaller on purpose.
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}

/** Serialised exactly as it will be written, so a re-run is byte-identical. */
export function manifestJson(theme, options) {
  return `${JSON.stringify(manifest(theme, options), null, 2)}\n`;
}
