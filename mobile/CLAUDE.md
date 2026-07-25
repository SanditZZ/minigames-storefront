# Native client rules — `mobile/`

Expo (SDK 57) React Native clients. `mobile/admin` exists; `mobile/player` does
not yet.

## Why this is outside the frontend workspace

`mobile/` is its own npm project, like `e2e/` and for the same reason. npm
workspaces install every member's dependencies together, so putting an Expo app
in `frontend/apps/` would make CI's `npm ci` — a job that only typechecks and
builds two web bundles — download React Native, Reanimated and the Expo tree on
every push. The web apps also gain no benefit from seeing them.

The cost of the split is that shared code arrives as `file:` dependencies rather
than workspace symlinks, which Metro needs to be told about. That is what
`metro.config.js` does, and it is a dozen lines. It is the cheaper half of the
trade.

## What may be shared, and what may not

Shared code lives in `frontend/packages/*` and is consumed by name:

| Package | Used natively for |
|---|---|
| `@minigames/api-client` | every request; it is dependency-free and browser-free |
| `@minigames/admin-core` | the Location grammar and `visibleAwards` |
| `@minigames/tokens` | palette values, incl. `colors.json` for NativeWind |

**Never import from `frontend/apps/*`.** Those are React DOM. If something there
looks worth reusing, that is a signal it was in the wrong layer: move the pure
part into a package first, then import the package. The rule in
`frontend/CLAUDE.md` — packages import no React, touch no `window`, reach no
network — is what keeps this possible.

## Styling: NativeWind, same class names, different Tailwind

`className="bg-brand"` works here and means the identical `#FF9A86`, because
`tailwind.config.js` requires the generated `@minigames/tokens/colors.json`
rather than restating hexes. The palette rules in `frontend/CLAUDE.md` apply
unchanged.

Two mismatches to keep in mind:

- **NativeWind 4 pins Tailwind v3; the web apps are on v4.** The two never share
  a config, only the token values. Do not assume a v4-only utility exists here.
- **Native platform views take style objects, not classes.** `expo-router`'s
  header is a real platform view, so `app/_layout.tsx` imports `COLORS` from the
  tokens package directly. That is correct, not a workaround — but in ordinary
  RN components, use `className` so the palette stays greppable.

## Networking — the part that fails first

An installed app is held to rules a browser tab is not. `app.config.ts` opens
both exceptions this stack needs:

- **iOS**: `NSAllowsLocalNetworking`, not `NSAllowsArbitraryLoads`. The narrower
  key is enough for a Tailscale/LAN address and does not disable ATS globally.
- **Android**: `usesCleartextTraffic` via `expo-build-properties`. Because it is
  a *native build property*, it only applies in a development or EAS build —
  **Expo Go will still refuse cleartext**. If the awards list loads in a dev
  build but not in Expo Go, this is why, and it is not a bug in the app.

Both are correct only for internal distribution over a private tailnet. Putting
this in front of anyone else means terminating TLS at the API and deleting both
— not widening them.

**There is no `localhost` default for the API host, on purpose.** A phone
resolves `localhost` to itself, so a default would fail as a baffling connection
error rather than a clear one. Build with the address `serve-prod.sh` prints:

```bash
EXPO_PUBLIC_API_URL=http://100.64.124.94:8081 npx expo start
```

## Credentials

The admin secret goes in `expo-secure-store` (the OS keychain), never
`AsyncStorage` — the web app's `localStorage` has no safe native equivalent. Note
that a shared secret living on staff phones is a weaker position than one in a
browser tab that gets closed; this is the strongest argument for the "Real auth"
item in `docs/potential-features.md`.

## Testing — the honest gap

`scripts/ship.sh` step 4 **typechecks** this app. Nothing runs it.

The web player is exercised in a real browser by the Playwright suite before
every push, and the repo's rule is never to push around that. The native client
has no equivalent: a screen that compiles and then crashes on device ships
green. Until a Maestro suite exists, treat a green `ship.sh` as saying nothing
about whether the Expo app works, and check a real device before trusting a
native change.

`npm run bundle` is the deeper local check — it runs Metro end to end and is
what catches broken module resolution after moving a shared package or editing
`metro.config.js`. The typecheck alone will not.

## Icons

Generated, like the web ones: `node scripts/icons/gen-icons.mjs` writes
`assets/icon.png` and `assets/adaptive-icon.png` from the same glyph and theme
as the admin favicon. `adaptive-icon.png` is Android's foreground LAYER — it is
transparent and drawn smaller, because the launcher composites it over
`adaptiveIcon.backgroundColor` and only guarantees the inner 66/108dp circle.
Never hand-make a native icon; it is how two surfaces of one product start
looking like two products.
