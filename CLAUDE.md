# Repo rules — minigames-storefront

## Always run the full test suite before every push — REQUIRED

**No commit reaches `origin/main` without the whole suite passing first.** This is
not advisory: `scripts/ship.sh` enforces it, and `.github/workflows/ci.yml` runs
the same checks again on the pushed commit.

The gate, in order — each step must pass before the next runs:

1. `go test ./...` — backend unit tests.
2. `npm run typecheck && npm test` (frontend) — project-wide TS build, then
   vitest over the calculation layers (URL router, score-reveal maths).
3. `npx tsc --noEmit && npx playwright test` (e2e) — the real player flow in a
   browser, against an isolated throwaway stack (own ports, own temp SQLite file
   — never `.prod/`).
4. Build + redeploy via `scripts/serve-prod.sh`.
5. Only then: `git add -A`, commit, `git push origin main`.

**The gate and CI must run the same commands.** `ship.sh` invokes the npm
scripts by name rather than re-spelling them, so the two cannot drift. A
lookalike command that "does the same thing" is how a broken `typecheck` script
survived unnoticed — the gate never called it.

**E2E is a LOCAL gate only.** GitHub Actions runs steps 1, 2 and 4 plus a
typecheck of the E2E specs; it does not run the browser suite, which would cost
minutes of runner time per push. That makes step 3 above the only place the
player flow is exercised in a browser — so never push around it.

**Never push on red.** If a test fails, fix it or report and stop — do not
comment it out, do not `--no-verify`, and do not reach for `SKIP_E2E=1` (that
escape hatch exists only for machines where browsers cannot run at all).

## Auto-ship after every change (build-gated) — REQUIRED

After making **any** change to this repo (code, config, or docs), always run the
ship flow before considering the change done — do not skip it:

```bash
./scripts/ship.sh ["commit message"]
```

### Rules

- **Never commit or push if tests or the build fail.** `main` must always stay
  green and deployable.
- **Always push to `main`.** Every applied change ends up on the remote.
- **No `Co-Authored-By`** lines in commit messages.
- Redeploy is part of shipping — the user expects the running apps to update after
  every change, not just the code.
- The deploy binds servers to `0.0.0.0` and bakes the auto-detected Tailscale IP
  into the frontend builds (see `scripts/serve-prod.sh` and the global "Local
  Deployment" rules), so the apps stay reachable across the tailnet.

## Testing layout

- `backend/**/*_test.go` — Go unit tests. The app layer uses an in-memory
  `storage.Store` fake (`internal/app/service_test.go`), so no DB is needed.
- `frontend/apps/*/src/**/*.test.ts` — vitest, **calculations only** (pure
  functions: no DOM, no components). Component and flow behaviour is covered by
  the browser suite instead of a jsdom imitation of it.
- `e2e/` — Playwright. A self-contained npm package, deliberately outside the
  frontend workspace so it never enters an app build. It starts its own API and
  player app via `webServer` and wipes its database before each run.

When adding a game or a screen, add the pure logic to a calculation module and
test it in vitest; add one E2E assertion only if it changes the player's path
through the app.

## Admin access

The admin API is guarded by a shared secret (`APP_ADMIN_TOKEN`), defaulting to
`admin` for local development. Set a real one in any deployment that matters.

## Related

- `frontend/CLAUDE.md` — mandatory color palette + reusable-UI-component rules.
- `docs/architecture.md`, `docs/potential-features.md` — design + roadmap.
