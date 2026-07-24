# Architecture

## Goal

A storefront engagement experiment: a customer who buys a physical product gets
to play a short mini-game (each finishable in under a minute) for a chance to
win a configurable reward. High scores and rewards persist. The code is built to
add many games and to swap the database with minimal change.

## Principles

1. **ACD layer separation** (Data / Calculations / Actions) — enforced in the Go
   backend. Business rules live in pure, unit-tested functions; side effects are
   isolated and thin.
2. **Backend is the single source of truth** — the client never decides elapsed
   time, validity, ranking, or which prize is won. It only measures input and
   renders what the server returns.
3. **Extensibility at the seams** — a game registry and a storage interface are
   the two designed extension points.

## Backend layers

```
domain/      DATA        types, enums, constants. Zero logic, zero imports from other layers.
game/        CALCULATION pure scoring + anti-cheat validators + the game registry.
reward/      CALCULATION pure award-selection (score + config -> best eligible prize).
storage/     PORTS       repository interfaces (Store) — the DB swap seam.
  sqlite/    ADAPTER     the only place SQL lives; implements Store.
app/         ACTIONS     use-case orchestration (start session, submit score, seed).
config/      ACTIONS     env loading.
httpapi/     ACTIONS     thin HTTP handlers + middleware; parse/marshal only.
```

Dependency direction: `httpapi → app → {game, reward, storage} → domain`.
Calculations never import actions; actions never embed business rules.

## Request flow — playing a round

```
player app                         backend
   │  POST /games/{slug}/sessions      │  issue single-use token, server clock + TTL
   │◄──────────────────────────────────┤
   │  (play locally, count score)      │
   │  POST /games/{slug}/scores        │  1. validate value vs server-derived elapsed time (game.Validator)
   │   {token, playerName, value}      │  2. consume session atomically (replay -> 409)
   │                                   │  3. persist score
   │                                   │  4. reward.Select -> reserve stock atomically
   │◄──────────────────────────────────┤  { score, rank, award? }
```

Anti-cheat, ranking, and prize selection all happen server-side. The session is
the trust anchor: it fixes when the round started and is single-use.

## Extension point 1 — adding a game

1. **Backend:** add a `game.Definition` (catalog data + a pure `Validator`) to
   `game.DefaultRegistry()`. Scores, sessions, rewards, leaderboards, and admin
   are game-agnostic and work immediately.
2. **Player frontend:** add a component implementing `PlayProps` and register it
   in `apps/player/src/games/registry.ts` under the same slug. The shared
   `RoundRunner` + `GameStage` provide session handling and consistent chrome.

No other code changes. Games are validated independently and never trusted from
the client.

## Extension point 2 — swapping the database

Everything depends on the `storage.Store` interface, not on SQLite. To move to
DynamoDB (or Postgres, or a test fake):

- Implement `storage.Store` and its repositories in a new package (e.g.
  `storage/dynamo`).
- Change one line in `cmd/server/main.go` (`sqlite.Open` → `dynamo.Open`).

The repositories are written as **access patterns, not tables** (e.g.
`Scores.Top(game, direction, limit)`, `Sessions.Consume(token)` as an atomic
conditional write), which maps cleanly onto a DynamoDB single-table design.
Timestamps are stored as RFC3339 strings for portable round-tripping.

## Rewards model

An `Award` is configurable data: name, description, image, target game (empty =
any game), a `minScore` threshold, `stock` (`-1` = unlimited), `active`, and
`sortOrder`. `reward.Select` (pure) picks the hardest threshold a score cleared,
honouring the game's score direction; `app` then reserves stock with an atomic
decrement (out-of-stock during a race → it falls back to the next-best award).

## Settings

Runtime-tunable knobs live in the `settings` store so admins change behaviour
without a redeploy: `session_ttl_seconds`, `max_taps_per_second` (anti-cheat
cap), `high_score_limit`, `allow_replays`. Values are typed and validated on
write.

## Frontend

Two Vite + React + TS apps in an npm workspace sharing a typed `api-client`
package (the request/response contract mirrors the Go domain). The **player**
app is a kiosk-style state machine; the **admin** app is a shared-secret-gated
CRUD dashboard. All UI is built from a small reusable kit and one central warm
palette (see `frontend/CLAUDE.md`) so every game looks like one product.

## Deployment

`scripts/serve-prod.sh` builds the API binary (`go build`) and both frontend
bundles (`vite build`), then serves all three on auto-selected free ports
(`vite preview` for static apps). The backend URL is baked into the frontend
builds and CORS is wired to the chosen frontend origins. No Docker/nginx needed.

## Security notes (experiment-stage)

- Admin API is guarded by a shared-secret header (`APP_ADMIN_TOKEN`), compared in
  constant time. This is a gate, not full user auth — see potential-features.md.
- Anti-cheat is heuristic (plausible-rate ceiling + single-use server-timed
  sessions). It raises the bar for casual tampering; it is not a hard guarantee.
