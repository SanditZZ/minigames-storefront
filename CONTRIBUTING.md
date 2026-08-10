# Contributing

Thanks for considering a PR. This is a small, single-maintainer project, so the
goal here is to make it easy to make a correct, well-scoped change without
having to read the whole codebase first.

If you're looking for somewhere to start, check the repo's issues for a
`good first issue` label, or read [`docs/potential-features.md`](docs/potential-features.md) —
it's the maintainer's own list of what's deliberately not built yet, with a
file/symbol cited for every entry so you can see exactly what it's asking for.

## Before you write code

- **Small PRs over big ones.** One behavior change, one bug fix, one small
  feature. A PR that touches one game, one endpoint, or one screen is much
  easier to review than one that touches several.
- **Read [`CLAUDE.md`](CLAUDE.md) first** if you're touching the backend or the
  frontend package split — it's the maintainer's own rules for this repo (layer
  separation, where a string lives, how ids are generated) and PRs that follow
  it get merged faster than PRs that don't.
- If your change is bigger than a small fix, open an issue first and describe
  what you're planning — it's a lot cheaper to redirect an approach before code
  is written than after.

## The three layers, and the one rule that matters most

The backend (and the frontend's `packages/`) follow **ACD layering**:

- **Data** — types, constants, plain objects. No logic.
- **Calculations** — pure functions. Input in, output out. No DB, no HTTP, no
  `window`, no logging. Fully unit-testable.
- **Actions** — side effects only (DB writes, HTTP handlers, UI updates). Thin;
  they delegate logic to calculations.

Concretely: a `packages/*` module may not import React, touch `window`/`document`,
or reach the network — that's what makes it reusable from the native client too.
See `frontend/CLAUDE.md` for the full version of this rule.

## Local setup

See the [Quick start](README.md#quick-start) in the README for running the
backend and both frontends locally.

## Running the tests

Three layers, cheapest first — run whichever ones your change touches, and the
last one before opening a PR:

```bash
# Backend — Go unit tests
cd backend && go test ./...

# Frontend — pure calculation modules only (router, reveal maths, etc.)
cd frontend && npm run theme:check && npm run typecheck && npm test

# End-to-end — the real player + admin flow, driven in a real browser
cd e2e && npx tsc --noEmit && npx playwright test
```

**Run `./scripts/ship.sh` before opening a PR.** It runs all three layers in
order, then builds and locally redeploys, then checks data integrity — the same
gate the maintainer runs before every push (see `CLAUDE.md` for exactly what
each step does and why). It stops at the first failure, so a red step tells you
what to fix before going further.

### What CI does and doesn't cover

`.github/workflows/ci.yml` runs on every push and PR, but only two of the three
layers: Go tests and the frontend typecheck/unit tests (plus a typecheck-only
pass over the E2E specs — no browser). **The Playwright browser suite does not
run in CI today** — it's local-only, via `ship.sh`. This means a PR can go
green in GitHub and still break the real player flow if you didn't run
`npx playwright test` yourself. Adding a PR-gated E2E job is filed in
`docs/potential-features.md`; until it lands, please run the E2E suite locally
for any change that touches a game, a screen, or an endpoint the apps call.

## Adding a mini-game

This is the single most template-able contribution. See "Extension point 1" in
[`docs/architecture.md`](docs/architecture.md) for the full walkthrough. In
short, a new game must:

1. Add a `game.Definition` (with a `TargetScore`) to the backend registry.
2. Translate its name, description, and score unit in `internal/game/i18n.go`
   (both English and Thai — `npm run typecheck`/`go test` fail on a gap).
3. Add a player component implementing `PlayProps`, registered in
   `apps/player/src/games/registry.ts`.
4. Pick an existing Phosphor-fill icon name from `packages/icons`, or add one.

`docs/potential-features.md` lists several games sketched out and ready to
build (Odd One Out, Quick Math, etc.) if you want a concrete starting point.

## Commit messages and PRs

- Describe *why* the change was made, not just what changed — the diff already
  shows what changed.
- Keep a PR to one logical change. If you find yourself writing "also fixed…"
  in the description, that's usually a second PR.
- Open the PR against `main`.

## Code style

- **Go**: `gofmt` (and `go vet`) is the bar — no separate linter is configured.
- **TypeScript**: no separate linter is configured either; `tsc` (via
  `npm run typecheck`) is the enforced check. Match the style of the file
  you're editing.
