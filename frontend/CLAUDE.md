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

## Component rule

Always build with reusable UI components. Shared primitives live in `src/ui/`
(player) — Button, Card, Stat, ProgressBar, Spinner, Screen, GameStage. Don't
duplicate styled markup; extend the kit.
