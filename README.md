# Minigames Storefront

A fullstack monorepo of short, fast mini-games (finish each in under a minute) that
storefront customers play for a chance to win a reward after buying a physical product.
Built to experiment with **customer retention and engagement**.

- **Backend** — Go, ACD-layered (data / calculations / actions). SQLite today, designed to
  swap to DynamoDB (or any store) without touching business logic.
- **Player frontend** — React + TS + Tailwind (Vite). Play a game, submit a score, reveal a reward.
- **Admin frontend** — React + TS + Tailwind (Vite). CRUD awards, score thresholds, and settings.

## Layout

```
minigames-storefront/
├── backend/                Go API server
│   ├── cmd/server/         main entrypoint
│   ├── internal/
│   │   ├── domain/         DATA — types, constants, enums (no logic)
│   │   ├── game/           CALCULATIONS — pure game scoring/validation
│   │   ├── reward/         CALCULATIONS — pure award-selection logic
│   │   ├── storage/        repository interfaces (the swap seam) + sqlite impl
│   │   ├── config/         env config loading
│   │   └── httpapi/        ACTIONS — HTTP handlers, router, side effects
│   └── migrations/         SQL schema
├── frontend/               npm workspaces
│   ├── packages/api-client shared typed API client + domain types
│   └── apps/
│       ├── player/         customer-facing game app
│       └── admin/          reward + settings admin
└── docs/                   architecture + potential features
```

## Quick start

```bash
# Backend (http://localhost:8080)
make backend           # or: cd backend && go run ./cmd/server

# Frontend (player http://localhost:5173, admin http://localhost:5174)
make frontend-install
make player            # or: npm run dev -w apps/player
make admin             # or: npm run dev -w apps/admin
```

See [docs/architecture.md](docs/architecture.md) and [docs/potential-features.md](docs/potential-features.md).
