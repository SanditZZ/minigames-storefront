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

Defined once in **`packages/tokens/src/palette.ts`**. Re-theme by editing those
five values only, then `npm run theme`.

## Tokens are data — don't hand-edit theme.css

`apps/*/src/theme.css` is GENERATED from `packages/tokens` and committed. It
carries the `@theme` block: the five `--color-*` tokens, plus the eight
`--animate-*` timings for the player.

```bash
npm run theme         # regenerate both apps' theme.css
npm run theme:check   # fail if the committed CSS drifted from the tokens
```

`theme:check` is a **gate step**, not a courtesy: `scripts/ship.sh` and
`.github/workflows/ci.yml` both run it before the typecheck. Editing a
`theme.css` by hand now fails the build rather than surviving until someone
regenerates.

### The runtime override — the second source of colour

A store can set its own palette from the admin (`color_brand`, `color_ink`, …),
which means there are now two sources of colour. **The precedence rule is one
line and it lives in `packages/tokens/src/override.ts`:**

> The tokens are the palette. A setting that is present AND a valid colour
> overrides one of them. Anything else — absent, blank, malformed — is not an
> override and the token stands.

Consequences worth knowing before touching either side:

- **Colour settings are never seeded.** Absent means "follow the tokens", so
  editing `palette.ts` still re-themes every store that has not opted out. Seed
  them and every database pins its palette on the day it was created.
- **An operator who sets a colour has opted out of future token changes** for
  that colour until they clear it. That is what the admin's reset is for.
- **`--color-*` is the contract.** Tailwind v4 compiles `bg-brand` to
  `var(--color-brand)`, so the override works by redefining that property on the
  root element — in `useBrandPalette`, which is per-app because it touches
  `document`. Renaming a token renames a public API.
- **Opacity utilities lag on old browsers.** `text-ink/70` compiles to a
  `color-mix()` over the variable behind an `@supports` guard, with a baked hex
  fallback, so a browser without `color-mix` re-colours the solid shades only.
- **Nothing checks contrast.** The rules in the table above are what the tokens
  were chosen to satisfy; an operator can set five colours that violate all of
  them. See `docs/potential-features.md`.

React Native has no stylesheet — styles are plain JS objects — so a palette that
only exists as CSS cannot follow these apps onto a phone. Holding the values in
TypeScript and generating the CSS keeps "edit one place" true across web and
native both. `PALETTE` carries each colour's role string alongside its value, so
the rule in the table above travels with the number instead of living only here.

### What is and isn't shared

- **Shared:** colour values, animation durations and easings. "The pop-in lasts
  420ms on a back-eased curve" is the same design decision on any platform.
- **Not shared:** `@keyframes`. Their geometry is CSS-only — React Native
  expresses the same motion as a Reanimated worklet — so they stay hand-written
  in each app's `index.css` and the generator never touches them.
- `REVEAL_DURATION_MS` lives in `player-core`, not here: it is a gameplay beat
  the score maths is written against and the player can skip, not decoration.

Only the player gets `--animate-*`. Admin has no keyframes, so emitting the
utilities there would offer classes that resolve to nothing.

## Package boundary (MANDATORY)

`packages/` is the code a native client reuses verbatim; `apps/` is what gets
written twice. **No package may import React, touch `window`/`document`, or
reach the network.** When something needs one of those, split it the way
`router/` already is — pure `parse.ts` in the package, thin `useRouter.ts` in the
app — rather than pulling the browser into a package. The full layout is in the
repo-root `CLAUDE.md`.

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

## Icons: Lucide, as data — emoji are not icons

**The set is [Lucide](https://icones.js.org/collection/lucide), and it is the
only one.** Every icon in either app is transcribed from it into
`packages/icons`; nothing in this repo draws, traces, or invents one. A mark
Lucide does not have is a prompt to choose a different mark, not a second set —
mixing sets is what makes an interface look assembled rather than designed.

**No emoji in either app's UI.** Not in buttons, empty states, badges, list
rows, or a string in a dictionary. Why this is a rule and not a preference:

- **An emoji is a font glyph, so the platform picks the artwork.** The same
  character is Noto on Android, Apple Color Emoji on iOS, and an empty box on a
  kiosk browser with no emoji font. Nothing in `packages/tokens` can touch it.
- **It cannot take the palette.** Every other mark in these apps is `ink` or
  `brand` and follows a store's runtime override. Emoji were the only marks on
  screen that ignored a store's branding entirely — the tier ladder was the
  clearest case, six fixed-colour glyphs beside fully themed text.
- **Its accessible name is not ours.** A screen reader says "party popper" where
  the design means "you won", and 🎟️ reads as "admission ticket" beside a claim
  code.
- **Sizing is typographic, not geometric.** An emoji scales with `font-size` and
  its optical weight is whatever the font decided, so an icon next to a 14px
  label and the same icon in a 40px hero are unrelated shapes.

### The shape of the system

Geometry is **data**, drawn by each app — the same split as the colour tokens,
and for the same reason. `packages/icons` holds every icon as a list of shape
objects (`{ tag: "path", d }`, `{ tag: "circle", cx, cy, r }`, …), not as SVG
markup, because markup is a web thing: React Native draws with
`react-native-svg` components instead, so a `<svg>` string could not have
followed these icons onto a phone. Each app's `src/ui/Icon.tsx` is the twenty
lines that turn a shape list into markup. They are near-identical **on purpose**
— a package may not import React, and each app already owns its own `Button`,
`Card` and `Layout` on that same principle.

- **`IconName` is a union derived from the table**, so `icon="giftt"` fails
  `npm run typecheck` instead of rendering an empty box nobody notices. Every
  prop that takes an icon is typed with it — `StatusMessage`, `HighlightCard`,
  `PrizeImage`, and `MiniGame.icon`.
- **`MiniGame.icon` being typed is what stops the debt coming back.** While it
  was `string`, every new game added one more emoji and the clean-up got longer
  than it started.
- **A package names an icon; it never renders one.** `Tier.iconKey` sits beside
  `labelKey` and means exactly the same thing: the data says *which* mark, the
  app decides how to draw it. An emoji inside a dictionary string breaks this
  twice over, since it is both prose and a rendered mark.
- **`1em` and `currentColor` are the defaults**, so an icon takes the font-size
  and the ink colour of the slot it lands in — including a store's runtime
  palette override — and a `text-4xl` box keeps meaning what it meant.
- **`aria-hidden` is the default**, because an icon here is decoration beside
  copy that already carries the meaning. Give every icon-only control a real
  accessible name; `IconButton`'s required `label` already enforces this on the
  player side.

**Never draw one.** No authored path data, no CSS-shape approximations, no
model-invented SVG. If an icon seems to be missing from every set, the search
term is wrong.

**The one exception is `scripts/icons/`**, which renders the product's own mark
into launcher/PWA/favicon assets. That is packaging a brand asset in the sizes
platforms demand — not drawing an icon — and no icon set can supply it. See the
app-icon section above; those files stay generated.

## Component rule

Always build with reusable UI components. Shared primitives live in `src/ui/`
(player) — Button, Card, Stat, ProgressBar, Spinner, Screen, GameStage. Don't
duplicate styled markup; extend the kit.

### A kit control that wraps two inputs needs two names

**A `<label>` in the markup reads as coverage; only the accessibility tree
settles it.** A wrapping `<label>` associates with the FIRST labelable
descendant only, so any primitive that composes *two* controls behind one label
— `ColorInput` (swatch + hex box) and `DurationInput` (amount + unit) are the
two that exist — leaves the second one nameless however carefully the markup
reads. Give each inner control its own name derived from the caller's `label`,
and make `label` **required** rather than optional: a name a compiler can demand
is a name that cannot go missing again. Searching for controls with no label
nearby will not find this class of bug, because the label *is* nearby.
