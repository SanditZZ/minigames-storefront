# Frontend rules

## Color palette (MANDATORY)

The app uses one warm, light palette. Every screen, game, and both apps
(player + admin) must use ONLY these tokens. No ad-hoc hex values, and no
Tailwind stock palette colors (indigo/slate/etc.) for anything brand-related.

| Token (Tailwind) | Hex       | Name   | Role |
|------------------|-----------|--------|------|
| `brand`          | `#FF9A86` | Coral  | Primary actions/CTAs, key accents, progress & timer fills, active states, focus rings |
| `brand-2`        | `#FFB399` | Melon  | Secondary accents, hover states, gradient mid-stop |
| `brand-3`        | `#FFD6A6` | Apricot| Muted surfaces, subtle backgrounds, gradient stop |
| `brand-4`        | `#FFF0BE` | Cream  | App background base, lightest surfaces |
| `ink`            | `#4A2B20` | Ink    | ALL text and icons on light surfaces |

Defined once in each app's `src/index.css` via Tailwind v4 `@theme`. Re-theme by
editing those five vars only.

### Usage rules

1. **Background** = vertical gradient `from-brand-4 to-brand-3` (cream → apricot).
2. **Text/icons** = `ink`. Use opacity for hierarchy: `text-ink`, `text-ink/70`,
   `text-ink/50`. **Never white text on the pastels** — it fails contrast.
3. **Primary CTA** = `bg-brand` fill + `text-ink` label.
4. **Cards / panels** = white (solid) or `bg-brand-4/70` (muted); text `ink`.
5. **Accents** (progress bars, active leaderboard row, focus rings, badges) = `brand`.
6. **Secondary / hover** = `brand-2`. **Dividers / borders** = `ink/10`.
7. Every game inherits these via the **shared UI kit** (`src/ui/`) — never define
   per-game colors. Add new games by composing kit primitives.

## App icons + PWA — generated, never hand-edited

Everything in `apps/*/public/` is **derived**. The source of truth is
`scripts/icons/source.mjs` (the glyph path, the two themes, the render list);
the PNGs, `favicon.ico`, `favicon.svg` and `manifest.webmanifest` are snapshots
of it, committed so no build step depends on a browser.

```bash
node scripts/icons/gen-icons.mjs           # re-render both apps
node scripts/icons/gen-icons.mjs --check    # fail if the committed files drifted
```

Re-theme by editing `source.mjs` and re-running — the same edit-one-place rule
as the colour tokens above. A hand-edited PNG is silently reverted the next time
anyone regenerates.

### Rules

- **The two apps must stay visually distinct.** Player is the palette's
  primary-CTA pairing (coral field, ink mark); admin inverts it (ink field,
  apricot mark). The inversion is deliberate — an operator with both installed
  picks between two home-screen tiles, and the palette's "ink on light surfaces"
  rule assumes a light surface. Do not "fix" the admin icon back to the light
  scheme.
- **No transparent icons.** Every render paints a full-bleed background rect. A
  transparent mark is composited onto whatever the platform chooses and loses
  contrast on someone's device.
- **Maskable is a separate file, drawn smaller.** Android clips it to the
  launcher's shape and only guarantees the centred 80%-diameter circle. The
  glyph is wide, so the generator checks its *diagonal* against that circle
  (`fitsSafeZone`) and throws rather than shipping a cropped icon. Never merge it
  into the `any` entry with `purpose: "any maskable"`.
- **Rounding is off wherever the platform masks.** `apple-touch-icon` and the
  maskable render are square; pre-rounding them inside an OS mask produces a
  shrunken tile with pale corners.
- **PWA is install-only — there is no service worker.** Installability and
  offline are separate features: a cache would have to be invalidated on every
  `ship.sh` redeploy, and a kiosk that queues score submissions is the real
  offline story (see `docs/potential-features.md`). Don't add a service worker
  as a side effect of an icon change.

The generator borrows Chromium from `e2e/node_modules` because this box has no
`rsvg-convert` and ImageMagick's fallback SVG renderer mangles the glyph's arcs.
It is a dev tool only — no app build and no CI job runs it.

## Component rule

Always build with reusable UI components. Shared primitives live in `src/ui/`
(player) — Button, Card, Stat, ProgressBar, Spinner, Screen, GameStage. Don't
duplicate styled markup; extend the kit.
