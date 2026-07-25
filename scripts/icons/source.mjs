// DATA layer: the one description of the app icon. No logic, no I/O.
//
// Everything under public/ — favicons, apple-touch, manifest icons — is DERIVED
// from this file by gen-icons.mjs. Never hand-edit a generated PNG: re-theme
// here and re-run the generator, exactly like the colour tokens in index.css.

/**
 * Tabler Icons "device-gamepad-2", unmodified.
 *
 * MIT licensed — https://github.com/tabler/tabler-icons/blob/master/LICENSE
 * Authored on a 24×24 grid; the drawn shape spans x 1→23, y 5→19, so it is a
 * wide, short glyph centred on (12, 12). That aspect ratio is why the maskable
 * variant is sized off the diagonal below rather than off the box.
 */
export const GLYPH_PATH =
  "M20 5a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3zM8 9l-.117.007A1 1 0 0 0 7 10v1H6a1 1 0 0 0-1 1l.007.117A1 1 0 0 0 6 13h1v1a1 1 0 0 0 1 1l.117-.007A1 1 0 0 0 9 14v-1h1a1 1 0 0 0 1-1l-.007-.117A1 1 0 0 0 10 11H9v-1a1 1 0 0 0-1-1m10 3a1 1 0 0 0-1 1v.01a1 1 0 0 0 2 0V13a1 1 0 0 0-1-1m-3-2a1 1 0 0 0-1 1v.01a1 1 0 0 0 2 0V11a1 1 0 0 0-1-1";

/** The glyph's authoring grid. */
export const GLYPH_VIEWBOX = 24;

/**
 * The two install identities, drawn from the mandatory palette in
 * frontend/CLAUDE.md.
 *
 * Player is the palette's primary-CTA pairing (coral fill, ink mark) — the same
 * combination as every button a customer taps, so the home-screen icon and the
 * app agree. Admin deliberately INVERTS it: an ink field with an apricot mark.
 * The palette's "ink on light surfaces" rule assumes a light surface; on a dark
 * one the mark has to be a light brand tone. The inversion is the point — an
 * operator with both apps installed must tell the till app from the customer
 * app at a glance, and hue alone does not survive a crowded home screen.
 */
export const THEMES = {
  player: {
    app: "player",
    background: "#FF9A86", // brand — Coral
    mark: "#4A2B20", // ink
    name: "Fun Store — Play & Win",
    shortName: "Play & Win",
    description: "Play a quick game in store and win a prize.",
  },
  admin: {
    app: "admin",
    background: "#4A2B20", // ink
    mark: "#FFD6A6", // brand-3 — Apricot
    name: "Minigames Storefront — Admin",
    shortName: "Store Admin",
    description: "Manage prizes, thresholds and leaderboards.",
  },
};

/**
 * The renders each app needs, and why each one exists.
 *
 * `rounded` controls the corner radius only. It is off wherever the PLATFORM
 * supplies the mask — iOS clips apple-touch-icon itself, and Android clips a
 * maskable icon to whatever shape the launcher uses — because a pre-rounded
 * square inside a platform mask produces a visibly clipped, smaller-looking
 * icon with pale corners.
 */
export const RENDERS = [
  { file: "favicon-16.png", size: 16, scale: 0.78, rounded: true },
  { file: "favicon-32.png", size: 32, scale: 0.78, rounded: true },
  { file: "favicon-48.png", size: 48, scale: 0.78, rounded: true },
  { file: "apple-touch-icon.png", size: 180, scale: 0.72, rounded: false },
  { file: "icon-192.png", size: 192, scale: 0.72, rounded: true },
  { file: "icon-512.png", size: 512, scale: 0.72, rounded: true },
  { file: "icon-512-maskable.png", size: 512, scale: 0.62, rounded: false },
];

/** Sizes bundled into the legacy favicon.ico, largest last. */
export const ICO_SIZES = [16, 32, 48];

/**
 * The native clients' icons, written into each Expo app's assets/.
 *
 * `adaptive-icon.png` is the Android foreground LAYER, not a finished icon:
 * the launcher composites it over the `backgroundColor` set in app.config.ts,
 * so it must be transparent — a painted background here would show as a square
 * card floating inside the launcher's mask. It is also drawn smaller than the
 * web maskable render, because Android's adaptive safe zone (66 of 108dp) is
 * tighter than the web's 80%.
 */
export const MOBILE_RENDERS = [
  { file: "icon.png", size: 1024, scale: 0.72, rounded: false },
  { file: "adaptive-icon.png", size: 1024, scale: 0.5, rounded: false, transparent: true },
];

/** Which Expo app carries which theme. Player joins this when it is built. */
export const MOBILE_APPS = {
  admin: "mobile/admin/assets",
};

/** Android adaptive icons only guarantee the inner 66/108dp circle survives. */
export const ADAPTIVE_SAFE_ZONE = 66 / 108;
