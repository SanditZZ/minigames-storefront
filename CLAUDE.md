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

## Identifiers — nanoid(11) for entities, UUID for credentials

**Every persisted entity id is an 11-character nanoid, minted by `internal/id`.**
Never call a generator inline and never introduce a second id format.

```go
import "github.com/sanditzz/minigames-storefront/backend/internal/id"

entry := domain.ScoreEntry{ID: id.New(), /* … */}
```

- **Entity ids** (`scores.id`, `awards.id`, and anything added later) → `id.New()`.
  Eleven characters of nanoid's URL-safe alphabet carry 66 bits of entropy: short
  enough to read aloud, type, or print on a receipt, and unguessable in a public
  URL. `id.Length` and `id.Alphabet` are the only place those choices live.
- **Session tokens stay UUIDv4.** A token is a *credential* — an unguessable
  single-use permit to submit a score — not a name for something. It is never
  displayed, typed, or put in a URL, so shortening it buys nothing and would
  trade away entropy on the only secret in the play flow. See
  `id.TokenLengthNote`; the exception is deliberate, so don't "tidy" it away.
- `id.Looks(s)` is the pure shape check. It is what makes the data migration
  idempotent — use it rather than re-deriving "is this already a nanoid?".

### Migrating ids on existing data

`cmd/migrate-ids` converts a database in place. It follows the repo's script
rules: **dry run by default**, `-apply` to commit, a timestamped JSON backup
written before any write, and `-revert <file>` to undo. It is idempotent (rows
that already look like nanoids are skipped) and runs in one transaction, so a
failure leaves the database untouched rather than half-converted.

```bash
go run ./cmd/migrate-ids -db ../.prod/minigames.db          # dry run
go run ./cmd/migrate-ids -db ../.prod/minigames.db -apply   # commit
```

Stop the stack (`./scripts/serve-prod.sh --stop`) before applying, and remember
that rewriting `awards.id` must carry `scores.award_id` with it — the migration
does this in the same transaction; anything new that references an entity id
must be added to that carry list too.

## Admin access

The admin API is guarded by a shared secret (`APP_ADMIN_TOKEN`), defaulting to
`admin` for local development. Set a real one in any deployment that matters.

**Every admin view is addressable.** Panel, filters and the award being edited
all live in the URL (`apps/admin/src/router/`), never in component state, so a
view can be bookmarked, linked to a colleague, and survives a reload:

```
/awards?game=tap-fast&status=active   list, filtered
/awards/new                           create
/awards/V1StGXR8_Z5                   edit one prize
/scores?game=tap-fast                 leaderboard
```

`?game=` is deliberately shared between the awards and scores panels — an admin
investigating one game moves between its prizes and its board. Parameters at
their default value are never written, so an unfiltered panel stays a bare path.
Both apps use the same hand-rolled split: pure `parse.ts` (calculations, fully
unit-tested) and a thin `useRouter.ts` (the only module touching `window`).

## Roadmap — `docs/potential-features.md`

**"Potential features", "the features doc", or a bare "this doc" in a roadmap
conversation always means `docs/potential-features.md`.** It is the one list of
unbuilt ideas; never start a second roadmap file, and read it before proposing
new work so a suggestion is either already on it or genuinely new.

Keeping it true is part of shipping a feature, not a follow-up to it:

- **Strike through what shipped** — `~~**Name**~~ — **built.**` plus one line on
  what it actually proved out. Deleting the entry throws away the reason it was
  wanted in the first place.
- **Correct what the feature invalidated.** A shipped change usually falsifies
  some *other* entry rather than its own: the prize showcase started rendering
  `Award.imageUrl`, which quietly made "award image URLs are unused" wrong while
  leaving a narrower gap (the result screen) that nobody had written down.
- **Add the follow-ups the work surfaced**, ordered by how soon they will bite.

**Every claim in that doc is a claim about the code, so cite the file.** "Errors
are not announced" is only actionable because it names `StatusMessage`; an entry
that cannot be checked against a file is the kind that rots unnoticed.

## Related

- `frontend/CLAUDE.md` — mandatory color palette + reusable-UI-component rules.
- `docs/architecture.md` — design.
- `docs/potential-features.md` — the roadmap (see the section above).
