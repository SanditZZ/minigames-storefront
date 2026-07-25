# Handoff — Prize claim lifecycle

**Working document. Delete it when the feature lands.** It exists to start a
fresh session without re-deriving decisions already made.

Written 2026-07-25. Repo clean, `main` green at `d7eeb4a`, nothing in flight.

---

## 1. Read these first

The repo's rules are not optional and are not summarised faithfully here — read
the files:

- `CLAUDE.md` (root) — the ship gate, identifier rules, admin addressability,
  frontend package layout, and the roadmap-doc convention.
- `frontend/CLAUDE.md` — mandatory palette, token generation, package boundary.
- `mobile/CLAUDE.md` — Expo client, ATS/cleartext, the Maestro suite.
- `docs/potential-features.md` — the roadmap. **Any reference to "potential
  features docs" means this file.** Keeping it true is part of shipping.

The three rules most likely to be tripped by this feature:

1. **`./scripts/ship.sh ["msg"]` after every change.** Never push on red. Never
   `SKIP_E2E=1` to get past a failure.
2. **ACD layering.** Data / calculations (pure) / actions (side effects). Never
   define a pure function inside a handler; never put mutable module state in a
   file with pure functions.
3. **Identifiers.** Entity ids are `id.New()` — 11-char nanoid. Session tokens
   stay UUIDv4 and that exception is deliberate (`id.TokenLengthNote`).

## 2. Where the project is

Shipped this session, in order:

| Commit | What |
|---|---|
| `575c7cc` | Roadmap-doc convention in CLAUDE.md; `potential-features.md` audited against the code |
| `73b287b` | Cross-platform favicons + installable PWA manifests, generated from `scripts/icons/` |
| `b6dc24c` | Extracted `packages/tokens`, `player-core`, `admin-core` — the line native clients build along |
| `4edd84a` | Expo admin walking skeleton (`mobile/admin`), one real screen on shared packages |
| `d7eeb4a` | Maestro E2E suite for the native admin, on an isolated API stack |

State: web player + admin complete and tested; native admin is a **one-screen
skeleton** (awards list only, no CRUD); native player does not exist.

## 3. Why this feature, and how far to take it

The user confirmed this is an **experiment / portfolio piece — no real prizes at
stake**. That decides the scope:

- **Do** build a clean, well-tested lifecycle with real ACD separation.
- **Do not** gold-plate anti-abuse. No HMAC-signed codes, no rate limiting, no
  device attestation. Those are roadmap items and stay there.

The gap being closed: a winner currently sees *"Show this screen at the counter
to claim your prize"* (`ResultSummary.tsx`), which is screenshot-reusable and
has no redemption record.

## 4. Decisions already made

### 4.1 A `claims` table, not a status column on `scores`

`docs/potential-features.md` says this "only needs a status column", but that
note predates a bug found in the same audit (§4.2). A claim is a **credential
with its own lifecycle**; a score is an **immutable game result**. Seven fields
(code, status, issued/expires/redeemed timestamps, award snapshot) bolted onto
`scores` mixes the two. Separate table:

```sql
claims(
  id          TEXT PRIMARY KEY,   -- id.New(), nanoid(11)
  code        TEXT UNIQUE NOT NULL,
  score_id    TEXT NOT NULL,
  award_id    TEXT NOT NULL,
  award_name  TEXT NOT NULL,      -- SNAPSHOT, see §4.2
  issued_at   ...,
  expires_at  ...,
  redeemed_at ... NULL
)
```

Note there is **no `status` column** — see §4.3.

### 4.2 Snapshot `award_name` — this fixes a real bug

`Service.awardByID` (`backend/internal/app/service.go:199`) degrades a deleted
award to "no prize" rather than erroring. Correct for the API, but it means a
permanent result URL that read *"You won a Coffee"* starts reading *"So close!
No prize this time"* the moment an admin deletes that prize. Copying the award's
name onto the claim at issue time makes the win honest regardless of what
happens to the award afterwards. This is a roadmap item; strike it through when
done.

### 4.3 Status is DERIVED, not stored

`issued | redeemed | expired` is a pure function of `(redeemedAt, expiresAt,
now)`. Storing it as well creates two sources of truth that disagree the moment
a claim expires without anyone writing a row. Derive it in a calculation.

### 4.4 The claim code is a THIRD deliberate id format

Not a nanoid and not a UUID. It is transcribed by a human at a counter, so it
must exclude confusable characters (`0/O`, `1/I/L`) and be uppercase.

Proposal: 8 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (31 symbols ≈ 39 bits).

**This must live in `internal/id`**, alongside `New()` and `TokenLengthNote`,
with a comment explaining why it is a third format — the repo rule is "never
introduce a second id format", and the point of that rule is that all format
decisions live in one package. Follow the precedent of `TokenLengthNote`: make
the exception explicit and reasoned rather than tidying it away later.

Uniqueness is enforced by the `UNIQUE` constraint plus retry-on-conflict, not by
assuming 39 bits never collides.

## 5. File-by-file plan

### Group A — backend domain + calculations

| File | Action |
|---|---|
| `backend/internal/domain/domain.go` | add `Claim` struct + `ClaimStatus` consts. DATA only |
| `backend/internal/id/id.go` | add `NewClaimCode()` + `ClaimCodeAlphabet`/`ClaimCodeLength` + the why-a-third-format note |
| `backend/internal/id/id_test.go` | extend: alphabet excludes confusables, length, uniqueness smoke |
| `backend/internal/claim/claim.go` | **NEW, pure**: `StatusAt(claim, now)`, `CanRedeem(claim, now) (bool, reason)`, `Issue(score, award, now, ttl) Claim` |
| `backend/internal/claim/claim_test.go` | **NEW**: table-driven over the boundaries (expiry exactly at `now`, redeem-twice, redeem-after-expiry) |

### Group B — storage, service, HTTP

| File | Action |
|---|---|
| `backend/internal/storage/storage.go` | add `ClaimRepository` (Create, GetByCode, ListByStatus, Redeem) + `Claims()` on `Store` |
| `backend/internal/storage/sqlite/claims.go` | **NEW**: implementation |
| `backend/internal/storage/sqlite/sqlite.go` | add the `claims` table to `Migrate` + wire `Claims()` |
| `backend/internal/app/service.go` | issue a claim inside `SubmitScore` (after `reserveAward`, ~line 134); add `RedeemClaim(ctx, code)`; include the claim in `GetScore`'s `SubmitResult` |
| `backend/internal/app/service_test.go` | extend the in-memory fake with claims; test issue-on-win, no-claim-on-loss, redeem-once |
| `backend/internal/httpapi/claims.go` | **NEW**: `GET /api/v1/admin/claims`, `POST /api/v1/admin/claims/{code}/redeem` |
| `backend/internal/httpapi/server.go` | register routes (admin ones behind `s.requireAdmin`) |
| `backend/internal/httpapi/map.go` | wire `Claim` into the response DTOs |

### Group C — frontends (SEPARATE session; do not start without a pause)

| File | Action |
|---|---|
| `frontend/packages/api-client/src/types.ts` | `Claim` type + `claim` on `SubmitResult` |
| `frontend/packages/api-client/src/client.ts` | `listClaims`, `redeemClaim` |
| `frontend/packages/player-core/src/...` | any pure claim formatting (e.g. code grouping `ABCD-2345`) + vitest |
| `frontend/apps/player/src/components/ResultSummary.tsx` | show the code; replace the "show this screen" note |
| `frontend/apps/admin/src/components/ClaimsPanel.tsx` | **NEW**: look up a code, redeem it |
| `frontend/apps/admin/src/router/routes.ts` + `parse.ts` | add the `claims` tab — **must be addressable**, and `parse.ts` lives in `packages/admin-core` now |
| `e2e/tests/*.spec.ts` | one assertion: a winning round shows a claim code |
| `docs/potential-features.md` | strike through "Prize claim lifecycle is now one step away" AND the award-delete-rewrites-history item; add follow-ups |

## 6. Progress

1. ~~**Backend: claim domain, code format and pure lifecycle calculations**~~ —
   **done.** `domain.Claim`/`ClaimStatus`, `id.NewClaimCode` +
   `NormalizeClaimCode` + `LooksLikeClaimCode`, and the pure
   `internal/claim` package (`TTL`, `Issue`, `StatusAt`, `CanRedeem`, `Filter`).
   Two things worth carrying forward:
   - **`Filter` exists because status is derived.** An admin list therefore
     *cannot* be filtered with `WHERE status = ?` — that would re-implement
     `StatusAt` in SQL and reintroduce the second source of truth §4.3 avoids.
     The store lists rows; the calculation decides what they are. `ListByStatus`
     in the §5 plan should be `List` (plus `ListByScore`) for this reason.
   - **The expiry boundary matches the session rule** (`now.After`), so a claim
     inspected at the exact nanosecond of expiry is still valid. One convention
     for "expired" across the repo.
2. ~~**Backend: storage, service wiring and HTTP endpoints**~~ — **done.**
   `claims` table (migration 003), `claimRepo`, `SettingClaimTTLHours` seeded at
   168, issue-on-win inside `SubmitScore`, `RedeemClaim`, `ListClaims`, and
   `GET|POST /api/v1/admin/claims` behind `requireAdmin`. Decisions made while
   wiring, none of which were in the plan:
   - **A failed claim write does not fail the submission.** By the time
     `issueClaim` runs, the score row is committed and the award's stock is
     already decremented. Erroring would tell the player their round did not
     count when it did, *and* would not return the stock. It logs and returns
     nil instead — so a win can exist with no code. That is the reason the
     roadmap now carries a `cmd/backfill-claims` entry.
   - **The claim code is retried, not trusted.** Five attempts on
     `storage.ErrConflict`; a sixth collision means something is wrong with the
     generator rather than bad luck, so it gives up loudly.
   - **`ScoreResult` re-reads the claim, never re-issues it.** One round earns
     exactly one claim; revisiting the URL must show the same code.
   - **SQLite gets its own tests** (`sqlite/claims_test.go`) — the first in the
     repo. They exist precisely *because* `issueClaim` swallows write failures:
     a broken INSERT would otherwise be invisible to the service tests (which
     use a fake) and to Playwright (which would see a normal winning round).
3. **Backend: run the gate and ship the claim API** — then pause for review
   before touching either frontend.

Group C above is deliberately *not* in that list; it is the next session's work.

**One correction to the §5 Group C plan:** `parse.ts` for the admin claims tab
lives in `packages/admin-core`, and the panel must read the claim's `status`
from the API response — do **not** re-derive it in TypeScript. It is derived
from a clock, and the player's device clock is not one the backend controls.
The API returns `{claim, status}` (`app.ClaimView`) for exactly this reason.

## 7. Environment notes (hard-won, do not rediscover)

- **Emulator**: the user IS in the `kvm` group. A shell started before that took
  effect has stale credentials — use `sg`, never sudo:
  ```bash
  sg kvm -c "$HOME/android-sdk/emulator/emulator -avd minigames-test \
    -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect -no-snapshot"
  ```
- **Mobile E2E** needs a *release* APK: `assembleDebug` ships no JavaScript (it
  pulls the bundle from a Metro dev server). `mobile/admin/scripts/run-e2e.sh`
  handles this, and builds only the attached device's ABI.
- `ship.sh` adds `~/.maestro/bin` and `$ANDROID_HOME/platform-tools` to PATH
  itself; the mobile step skips loudly when no device is attached.
- Toolchain on disk: `~/android-sdk` (7.7G), `~/.maestro` (350M).
- **No `adb`/emulator on PATH by default.** `ANDROID_HOME=$HOME/android-sdk`.
- Theme/icon artifacts are generated and committed; `npm run theme:check` and
  `node scripts/icons/gen-icons.mjs --check` fail on drift.

## 8. Questions — now answered

- ~~**Claim TTL.**~~ **Decided: an admin setting, defaulting to 7 days.**
  `domain.SettingClaimTTLHours` + `domain.DefaultClaimTTLHours = 168`, read
  through the existing `settingInt` path. `claim.TTL(hours)` converts it and
  treats **zero or negative as "never expires"** rather than "already expired" —
  the setting is a plain int, so a missing or fat-fingered value lands on 0, and
  the safe failure for a prize someone genuinely won is a claim that still works.
- ~~**Does an expired claim still show the prize name?**~~ **Decided: yes —
  show the win, mark the code dead.** The result screen keeps reading "You won a
  Coffee" (from the snapshotted `AwardName`), and the code area says the claim
  expired instead of rendering a redeemable code. This is why `award_name` is a
  snapshot; without it the copy would have nothing honest to show.
- **Still open:** should the native admin get the redeem screen? (Was the third
  bullet here; unchanged. A phone at a counter is the right device for it, but
  it is separate work with its own Maestro flow.)
- **Should the native admin get the redeem screen?** It is the obvious first
  real screen for `mobile/admin` (a phone at the counter is exactly the right
  device for scanning/typing a code), but it is a separate piece of work with
  its own Maestro flow.
