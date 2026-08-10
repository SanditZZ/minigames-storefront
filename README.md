# Minigames Storefront

A toolkit small businesses can run at the counter: a customer who just bought
something scans a code or taps a link and plays a short, fun mini-game —
finished in under a minute — for a chance to win something back. A discount on
their next visit, a free item, a coupon, whatever the business wants to
configure as the prize. It turns a purchase that would otherwise end at the
till into a small moment of interaction, and gives a shop a lightweight way to
build repeat visits and goodwill without standing up a full loyalty program.

Built as an experiment in **customer retention and engagement** — a fullstack
monorepo with a staff-facing admin (set up games, prizes, and stock) and a
customer-facing player app (play, win, redeem).

- **Backend** — Go, ACD-layered (data / calculations / actions). SQLite today, designed to
  swap to DynamoDB (or any store) without touching business logic.
- **Player frontend** — React + TS + Tailwind (Vite). Play a game, submit a score, reveal a reward.
- **Admin frontend** — React + TS + Tailwind (Vite). CRUD awards, score thresholds, and settings.
- **Native admin** — Expo (React Native), sharing pure logic with the web admin via a
  package boundary rather than a rewrite.

## Layout

```
minigames-storefront/
├── backend/                 Go API server
│   ├── cmd/server/          main entrypoint
│   ├── cmd/migrate-ids/     data-repair script (UUID → nanoid ids)
│   ├── cmd/backfill-claims/ data-repair script (issue claims a win never got)
│   ├── internal/
│   │   ├── domain/          DATA — types, constants, enums (no logic)
│   │   ├── game/            CALCULATIONS — pure game scoring/validation
│   │   ├── reward/          CALCULATIONS — pure award-selection logic
│   │   ├── claim/           CALCULATIONS — claim issuance/redemption rules
│   │   ├── storage/         repository interfaces (the swap seam) + sqlite impl
│   │   ├── config/          env config loading
│   │   ├── i18n/            server-owned player-facing strings (en/th)
│   │   └── httpapi/         ACTIONS — HTTP handlers, router, middleware
│   └── migrations/          SQL schema
├── frontend/                npm workspace
│   ├── packages/            framework-agnostic code shared by both web apps
│   │   ├── api-client       typed HTTP client + wire types
│   │   ├── icons            Phosphor fill icon paths as data
│   │   ├── tokens           palette + motion timings; generates each app's theme.css
│   │   ├── image-core       crop-and-zoom geometry for the photo editor
│   │   ├── qr-core          QR encoding for claim codes
│   │   ├── player-core      route grammar, reveal maths, prize merge, i18n
│   │   └── admin-core       route grammar, award filter/sort, form validation
│   └── apps/
│       ├── player/          customer-facing game app
│       └── admin/           reward + settings admin
├── mobile/
│   └── admin/                Expo native admin client (Maestro e2e flows)
├── e2e/                      Playwright browser suite — the real player + admin flow
├── scripts/                  ship.sh, serve-prod.sh, and generators (tokens, icons)
└── docs/                     architecture + the feature roadmap
```

See [`docs/architecture.md`](docs/architecture.md) for the request flow, the two
extension points (add a game / swap the database), and the rewards model, and
[`docs/potential-features.md`](docs/potential-features.md) for what's deliberately
not built yet.

## Quick start

```bash
# Backend (http://localhost:8080)
make backend           # or: cd backend && go run ./cmd/server

# Frontend (player http://localhost:5173, admin http://localhost:5174)
make frontend-install
make player            # or: npm run dev -w apps/player
make admin             # or: npm run dev -w apps/admin
```

The admin API is guarded by a shared secret, `APP_ADMIN_TOKEN` (defaults to
`admin` for local dev — set a real one anywhere that matters). See
`backend/internal/config/config.go` for every environment variable the server
reads.

## Testing

Three layers, cheapest first:

```bash
cd backend && go test ./...                          # Go unit tests
cd frontend && npm run theme:check && npm run typecheck && npm test  # calculations only
cd e2e && npx tsc --noEmit && npx playwright test     # the real player + admin flow, in a browser
```

`./scripts/ship.sh` runs all of it, in order, plus a build + local redeploy and
a data-integrity check, and stops at the first failure — see
[`CLAUDE.md`](CLAUDE.md) for the full gate and why each step exists. GitHub
Actions (`.github/workflows/ci.yml`) currently re-runs the first two layers on
every push/PR; the Playwright suite is local-only for now (see
`docs/potential-features.md`).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

[MIT](LICENSE)
