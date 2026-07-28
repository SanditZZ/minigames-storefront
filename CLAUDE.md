# Repo rules — minigames-storefront

## Always run the full test suite before every push — REQUIRED

**No commit reaches `origin/main` without the whole suite passing first.** This is
not advisory: `scripts/ship.sh` enforces it, and `.github/workflows/ci.yml` runs
the same checks again on the pushed commit.

The gate, in order — each step must pass before the next runs:

1. `go test ./...` — backend unit tests.
2. `npm run theme:check && npm run typecheck && npm test` (frontend) — the
   committed `theme.css` still matches `packages/tokens`, then a project-wide TS
   build, then vitest over the calculation layers (URL router, score-reveal
   maths).
3. `npx tsc --noEmit && npx playwright test` (e2e) — the real player flow **and
   the admin's side of it** in a browser, against an isolated throwaway stack
   (own ports, own temp SQLite file — never `.prod/`).
4. Build + redeploy via `scripts/serve-prod.sh`.
5. `backfill-claims -check` against the deployed database — the one step that
   reports without gating, because it judges the data rather than the change.
   See "Data-repair scripts" below.
6. Only then: `git add -A`, commit, `git push origin main`.

**The gate and CI must run the same commands.** `ship.sh` invokes the npm
scripts by name rather than re-spelling them, so the two cannot drift. A
lookalike command that "does the same thing" is how a broken `typecheck` script
survived unnoticed — the gate never called it.

**E2E is a LOCAL gate only.** GitHub Actions runs steps 1, 2 and 4 plus a
typecheck of the E2E specs; it does not run the browser suite, which would cost
minutes of runner time per push. That makes step 3 above the only place the
player flow is exercised in a browser — so never push around it.

**The native client has its own suite, on the same terms.** `ship.sh` step 4
typechecks the Expo app and then runs its Maestro flows against an isolated API
— the same throwaway-stack discipline as step 3 — but only when an emulator or
phone is attached. CI skips the Expo tree entirely. A skip is announced, never
silent; on a machine with no device, a green gate means the native client
compiled and did not run. See `mobile/CLAUDE.md`.

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
- **Sweep `docs/potential-features.md` BEFORE running `ship.sh`, as part of the
  change rather than after it.** Delete what the change shipped, correct what it
  invalidated, and file the follow-ups it surfaced — the full rules are under
  "Roadmap" below. This is listed here because it is a step of shipping and was
  being treated as a separate habit further down the file: `ship.sh` cannot check
  it, so the only thing standing between a stale roadmap and a green push is
  remembering it at exactly this point.
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
- `frontend/packages/*/src/**/*.test.ts` — vitest, **calculations only** (pure
  functions: no DOM, no components). Component and flow behaviour is covered by
  the browser suite instead of a jsdom imitation of it. The suites live beside
  the code they test, which since the shared-package split means they live in
  `packages/` — an app that still has a `.test.ts` under `apps/` is a sign the
  logic under it never got extracted.
- `e2e/` — Playwright. A self-contained npm package, deliberately outside the
  frontend workspace so it never enters an app build. It starts its own API and
  **both** apps via `webServer` — player on 5299, admin on 5298 — and wipes its
  database before each run. The ports and origins live in `e2e/stack.ts`, not in
  the config, because only one app can be `baseURL` and a spec has to be able to
  reach the other one without restating its address.

  **Being outside the workspace stops npm from linking `@minigames/*`; it does
  not forbid a relative import**, and where a value has a source in the frontend
  the suite imports it rather than copying it (`END_OF_ROUND_MS` in
  `helpers/round.ts` takes the app's own `endOfRoundMs`). The import may only
  reach into `packages/`, and the package boundary is what makes that safe: a
  module that may not import React, touch `window`, or reach the network is
  importable from a Node test runner by construction. Nothing under `apps/` is,
  and a spec that needs something from there wants a `data-` attribute or a real
  assertion instead.

When adding a game or a screen, add the pure logic to a calculation module and
test it in vitest; add one E2E assertion only if it changes the player's path
through the app.

**A spec that writes admin settings owns the cleanup.** The suite shares one
backend and runs sequentially, so a store name, a palette colour or a prize left
changed is inherited by every test after it — and file order is alphabetical, so
`admin-branding.spec.ts` runs before everything. Restore what you change, and
*assert* the restore landed: a cleanup that silently fails poisons the rest of
the run and the failure surfaces somewhere else entirely.

## Frontend package layout — the line native clients will be built along

`frontend/` is an npm workspace. What lives in `packages/` versus `apps/` is not
a filing preference; it is the boundary between what a React Native client can
reuse verbatim and what has to be written a second time.

```
packages/api-client    typed HTTP client + wire types
packages/icons         Phosphor fill paths as data; IconName is derived from it
packages/tokens        palette + motion timings as TS; generates apps/*/src/theme.css
                       plus the runtime-override precedence rule (override.ts)
packages/image-core    crop-and-zoom geometry: cover scale, pan clamp, export map
packages/qr-core       QR encoding for short codes: text → module matrix + SVG path
packages/player-core   route grammar, reveal maths, prize merge, game scoring,
                       the en/th dictionaries + locale precedence (i18n/)
packages/admin-core    route grammar, award filter/sort, branding + benchmark forms
apps/player            React DOM: screens, UI kit, useRouter, LocaleProvider, the games
apps/admin             React DOM: panels, UI kit, useRouter
```

**A package may not import React, touch `window`/`document`, or reach the
network.** That single rule is what keeps the packages portable. Anything that
breaks it belongs in an app, split the way `router/` already is: a pure
`parse.ts` in the package, a thin `useRouter.ts` in the app that is the only
thing knowing about history.

Both apps re-export their package's routing through `src/router/index.ts`, so
screens import `"../router"` and never have to know which side of the line a
symbol falls on. `apps/player/src/i18n/` is the same arrangement for language:
the dictionaries and the precedence rule are pure and shared, and only
`LocaleProvider` — which reads `navigator.languages` and sets `<html lang>` —
is per-platform.

**Language follows the same line as everything else.** The rule for where a
string lives is which side of the wire decides it:

- **The server owns what the server decides.** Game names, descriptions and
  score units (`backend/internal/game/i18n.go`) and every error a player reads
  (`backend/internal/i18n`) are translated server-side and arrive ready to
  render. The client never re-derives them.
- **The client owns chrome.** Buttons, headings, the reveal's tier ladder —
  `packages/player-core/src/i18n`. Round-tripping a button label through HTTP
  would make every screen wait on the network for its own furniture.
- **A package may not hold prose.** Calculations return message *keys*
  (`claimCopy`, `precisionVerdict`, `Tier.labelKey`); the component looks them
  up. English text inside `player-core` would pin the one package a native
  client reuses verbatim to a single language.
- **The locale is addressable**, like every other piece of state: `?lang=th` is
  a *pin*, and its absence means "follow the device" rather than "English" —
  which is why `Location.lang` is nullable and an unpinned URL stays bare.
- **Admin-entered free text is translated nowhere.** A store's name and an
  award's name are served exactly as typed, in every language; doing better is
  a schema change, and it is filed rather than half-done.

Adding a message means adding it to `en.ts` *and* `th.ts` — `Messages` is a
complete record, so a missing translation fails `npm run typecheck`.

**Design tokens are data, not CSS.** `packages/tokens` holds the five brand
colours and every animation's duration/easing as TypeScript; each app's
`src/theme.css` is generated from it and committed. Regenerate with
`npm run theme`, verify with `npm run theme:check`. React Native has no
stylesheet at all — styles are plain objects — so a palette locked inside a
`.css` file could not have followed the apps onto a phone. See
`frontend/CLAUDE.md` for the full rules.

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

### Data-repair scripts live in `cmd/`, and they all follow those rules

`migrate-ids` is the pattern, not the exception. Every script that touches
persisted data is dry-run by default, takes `-apply` to commit, writes a
timestamped JSON backup before the first write, and offers `-revert <file>`.
Stop the stack before applying any of them.

- `cmd/migrate-ids` — UUID → nanoid entity ids (above).
- `cmd/backfill-claims` — issues the claims that winning rounds should have
  earned. Two ways a win ends up without one: the round predates the claims
  table, or `issueClaim` failed at submit time and logged rather than failing
  the submission. Its `-check` mode is the detection half (below).

**A repair nobody knows to run is not a repair, so the script also detects.**
`backfill-claims -check` reads nothing but the tables, writes nothing at all,
and exits **2** when a winning round is missing its claim — a code distinct from
**1**, which means the check itself could not run. `ship.sh` step 6 runs it
against `.prod/minigames.db` after every deploy. Two rules that look like
softness and are not:

- **It warns; it does not gate.** A missing claim is a fact about the DATA, not
  a defect in the commit being pushed, and a docs push blocked by an old data
  hole is how a check gets deleted.
- **Wins whose award was deleted do not fail it.** Those can never be given a
  claim (`award_name` is a snapshot; there is no name left to snapshot), so
  counting them would pin the check red forever with no run able to clear it.
  They are reported every time instead. Award soft-delete is what would make
  them repairable — and only then should they count.

**A repair script reconstructs through the production calculation, never its
own copy of it.** `backfill-claims` builds each row with `claim.Issue`, so a
backfilled claim cannot disagree with an issued one — including about the
awkward part, that `Issue` starts the redemption window at the ROUND's time, so
backfilling a round older than the TTL correctly produces an already-expired
claim. Writing a friendlier rule into the script would have made the two paths
disagree about what a claim is.

**A repair's undo must not erase a real transaction.** `-revert` deletes only
rows still holding `redeemed_at IS NULL`: once a prize has been handed to a
person, that row is a record of something that happened, not the script's
output. Any future repair script that deletes rows inherits this rule.

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

- **DELETE what shipped — do not strike it through.** The doc is the list of
  what is *not* built; an entry that describes finished work is noise in the one
  place a session looks to decide what to do next, and a file that is half
  history reads as twice as much roadmap as it has. No `~~struck~~` entries, no
  "— **built.**" survivors.
  **Deleting is not discarding: relocate first, then delete.** Before an entry
  goes, ask what it says that the *code* does not. If it states a live rule —
  "the client's filename is discarded, not sanitised", "the coarsest unit that
  divides evenly", "this beat is a readout, not motion, so it skips `holdMs`" —
  that rule belongs in a comment beside the symbol it governs, or in the
  `CLAUDE.md` / `docs/architecture.md` that owns that area, and it has to be
  there *before* the entry is removed. If the rationale is already in the code,
  delete the entry outright; duplicating it in a roadmap is how the two versions
  start disagreeing. What must never survive the delete is the *shape* the entry
  had: prose about what the build proved, what the entry got wrong, and what it
  cost is a changelog, and `git log` already keeps it.
- **Correct what the feature invalidated.** A shipped change usually falsifies
  some *other* entry rather than its own: the prize showcase started rendering
  `Award.imageUrl`, which quietly made "award image URLs are unused" wrong while
  leaving a narrower gap (the result screen) that nobody had written down.
- **Add the follow-ups the work surfaced**, ordered by how soon they will bite.
- **Sweep out what has gone stale — every time, not only when it is convenient.**
  Before shipping, re-read the entries your change came near and check each
  against the code as it is now, not as the entry remembers it. Fix what is
  wrong in place; if a claim is no longer true and nothing replaces it, delete
  it. This is the rule that keeps the other three honest: a doc that is 90%
  accurate is read as if it were 100%, so the 10% is not a small defect — it is
  the entry that sends the next session to a file that no longer works that way.
  **A shipped entry is stale by definition**, so the sweep covers those too: if
  the feature exists, the entry describing it goes, under the relocate-then-
  delete rule above. What stays behind is only the part that is still *unbuilt*
  — the follow-ups the work surfaced, promoted to entries of their own rather
  than left as sub-bullets of something finished.

**Every claim in that doc is a claim about the code, so cite the file.** "Errors
are not announced" is only actionable because it names `StatusMessage`; an entry
that cannot be checked against a file is the kind that rots unnoticed.

**Line numbers rot fastest; counts rot next.** `service.go:264` and "three
identical requests" are both true only until the next edit, and neither fails
anything when it stops being. Prefer naming a symbol over a line, and write a
count so it says how to re-derive itself ("one per game") rather than freezing a
number. Where a bare number really is the point, say so — an entry that admits
"this count is already stale, re-derive it" is more useful than one that is
quietly wrong.

### Suggested next steps go in the doc, not just in the chat

**Every follow-up or "worth considering next" raised at a checkpoint is written
into `docs/potential-features.md` in the same change that raised it — without
being asked.** A suggestion that exists only in a conversation is gone when the
session ends, and the next session proposes it again from scratch as if it were
new. A checkpoint that lists three ideas and commits none of them has left the
doc less true than it found it.

**Write the entry BEFORE saying the suggestion out loud.** Not afterwards, and
not "as part of the next change" — the file edit comes first, and the sentence in
chat is then a report of something that already exists. That ordering is the
whole mechanism: no build can see a suggestion that was only ever spoken, so
nothing downstream will catch a missing entry, and an intention to write it later
is indistinguishable from having written it by the time the session ends.

**"Filed", "recorded" and "written into the doc" are claims about a file, so
check the file before making one.** A grep costs nothing and the alternative is
telling the user their roadmap contains something it does not — which is worse
than never having filed it, because it stops them from noticing. This is not a
hypothetical: a suggestion to fix an e2e helper race was reported as filed in one
breath and had never been written in the other.

The bar is the same as for any other entry — cite the file, and say when it will
bite. Small mechanical fixes are the exception that proves it: if the follow-up
is one line and the fix is obvious, do it instead of filing it, and then say that
is what happened rather than calling it filed.

## Icons come from Phosphor (fill) — never emoji, never drawn here

Every icon in either app is transcribed from
[Phosphor's fill weight](https://icones.js.org/collection/ph) into
`packages/icons`, which holds geometry as **`d` strings rather than SVG markup**
so a React Native client can draw the same table with `react-native-svg`. Each
app's `src/ui/Icon.tsx` is the per-platform half; a package may not import React.
**One set and one weight** — a second weight reads as two icon languages the
same way a second set does, so the table is fill only and the keys drop the
redundant `-fill` suffix.

**Emoji are not icons** (the platform picks the artwork, the palette cannot
reach them, and their screen-reader names are somebody else's), and **nothing in
this repo authors icon path data** — inventing a shape that already exists in a
set is wasted work twice over. `IconName` is derived from the table, so a name
that is not in it fails `npm run typecheck` rather than rendering an empty box:
that is what keeps a new game from adding a glyph the way every game used to.
The full rules, and the one exception (`scripts/icons/`, which packages the
product's own mark into launcher/PWA/favicon assets), are in
`frontend/CLAUDE.md`.

## Related

- `frontend/CLAUDE.md` — mandatory color palette, icon rules, reusable-UI rules.
- `mobile/CLAUDE.md` — the Expo clients: sharing rules, ATS/cleartext, test gap.
- `docs/architecture.md` — design.
- `docs/potential-features.md` — the roadmap (see the section above).
