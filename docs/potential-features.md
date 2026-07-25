# Potential features

Ideas worth considering as the experiment grows. Roughly ordered by leverage for
the stated goal (retention + engagement) and by how cleanly the current
architecture already supports them. Nothing here is committed.

## More mini-games (the core lever)

The registry pattern makes these cheap — one backend `Definition` + one player
component each:

- ~~**Reaction Timer**~~ — **built.** Tap when the screen flips; score is
  reaction ms. It was the first `LowerIsBetter` game, so it is what finally
  exercises the reward ladder, leaderboard ordering and reveal meter in their
  other direction end to end.
- **Precision Stop** — stop a moving bar in the target zone; score = distance
  from centre (`LowerIsBetter`).
- **Memory Flash** — repeat a flashed sequence; score = longest sequence.
- **Hold Steady** — keep a dot inside a shrinking ring; score = ms survived.
- **Quick Math** — answer as many as possible in N seconds.
- **Swipe/Whack** — tap targets that pop up; score = hits.

## Reward system depth

- **Probability / rarity** — award a prize with a configured chance, not just a
  hard threshold (e.g. "reach 40 → 20% chance of Coffee").
- **Daily / per-customer win caps** — limit prizes per person per day to control
  cost (needs customer identity, below).
- **Time-boxed campaigns** — awards with start/end windows and schedules.
- ~~**Prize claim lifecycle**~~ — **built.** A winning round issues an
  8-character code (`internal/claim`, the `claims` table); the player sees it on
  the result screen with a copy button (`ClaimCard.tsx`); an admin redeems it
  exactly once from the claims panel (`ClaimsPanel.tsx`, `/claims`). The
  screenshot reuse it existed to prevent is closed: the credential is now a
  server-issued code that can be marked used, not the screen itself.
  **QR encoding was never started** — the code is typed, which is fine at a
  counter and slow at a queue.
- **A claim has no owner.** Anyone holding the code can redeem it, which is the
  same trust model as a paper voucher and was the deliberate scope (this is a
  portfolio piece — no real prizes). If prizes ever have value, the gap to close
  first is that a code shared in a group chat is as good as the original.
- **Budget guardrails** — a global spend/units-per-day ceiling across all awards.
- **Weighted award tiers** — configurable rarity weights and per-tier stock alerts.

## Customer identity & retention mechanics

- **Purchase-linked play tokens** — a receipt/QR grants exactly one play, tying
  the game to an actual purchase (the real anti-abuse mechanism).
- **Lightweight accounts** — phone/email or loyalty-card link to track streaks,
  history, and personal bests.
- **Streaks & comeback rewards** — bonuses for returning N days in a row.
- **Referral plays** — earn a play by bringing a friend.

## Anti-abuse / integrity (before real prizes of value)

- **Server-authoritative scoring for suitable games** — send input events, not a
  final number, and compute the score server-side.
- **Rate limiting** per IP/device/session on session-create and submit.
- **Signed sessions / nonce** and device attestation for kiosk mode.
- **Anomaly detection** — flag improbable score distributions per device.

## Admin & operations

- **Real auth** — replace the shared secret with user accounts, roles
  (admin/staff), and audit logs of who changed which award/setting.
- **Analytics dashboard** — plays, win rate, prize burn-down, cost per
  engagement, funnel from purchase → play → claim.
- **Award image uploads** (currently a URL field) with storage + CDN.
- **Config change history** and one-click rollback for settings/awards.
- **A/B testing** thresholds and reward mixes to optimise retention.

## Player experience

- **Share score photo** — a "Share" button on the result screen that generates an
  image of the player's score, decorated with the store theme and name (currently
  **Fun Store**, from `player/src/brand.ts`). Render the card to a `<canvas>` from
  the same palette tokens, then hand the blob to the Web Share API
  (`navigator.share({ files })`) with a download fallback on desktop. The result
  screen already has everything the card needs — score, unit, rank, prize, player
  name — and the URL is permanent, so the image can carry a QR/short link back to
  it. See "Result URL polish" below for the link preview that pairs with this.
- **Image editor before sharing** — let the player decorate the generated card
  before saving: stickers/icons, a caption, maybe a frame or filter. Keep the
  editor's state as plain data (a list of placed items with position/scale/
  rotation) and the render as a pure `draw(state) → canvas` function, so the same
  description can be re-rendered at export resolution without a second code path.
  Worth scoping the sticker set to store branding to keep moderation trivial.
- **Localization (i18n)** — e.g. Thai/English toggle for storefront use. Note the
  reveal added a fair amount of new copy (tier ladder, "Game complete", empty and
  error states) — worth extracting strings before it grows further.
- **Sound and haptics** for the reveal — the animation beats are already there to
  hang them on (`navigator.vibrate` on the puck landing, a bell on a record).
- **Accessibility** — larger tap targets, reduced-motion mode, screen-reader labels.
  (Reduced motion and focus rings are done.) Two concrete gaps remain, both
  found while adding the second game:
  - ~~**The revealed score is never announced.**~~ — **built**, as a side
    effect of making the reveal unskippable. `ScoreReveal.tsx` now marks the
    count-up digits `aria-hidden` and announces the settled value once through a
    `role="status"` line. Worth noting what forced it: the old announcement was
    the *button's* label, so removing the button removed the only thing a screen
    reader was told. The accessibility fix was not optional cleanup afterwards —
    it was part of not regressing.
  - **Errors are not announced.** `StatusMessage` renders failures as ordinary
    text with no `role="alert"`, so a failed submit is silent.
  - Both are small, and `Spinner` in the same file (`ui/Feedback.tsx`) already
    models the pattern with `role="status"` + `aria-live="polite"` — there is no
    design question left to answer here, only the edit.
- ~~**Scope the no-select rule.**~~ — **built**, and the claim code is what
  forced it. `index.css` now defines `.no-select`, applied by `GameStage` (which
  wraps every live game) and by the two end-of-round stages, instead of sitting
  on `body`. Everything else selects normally. The entry predicted this would
  matter "once the prize lifecycle lands", and it did: an eight-character
  credential nobody can select or copy is not much of a credential.
- **Copying works without a secure context, deliberately.**
  `apps/player/src/clipboard/copy.ts` tries `navigator.clipboard` and falls back
  to `execCommand("copy")`. The fallback is the path this app normally takes,
  not a safety net: the clipboard API requires HTTPS or `localhost`, and the
  stack is served over plain HTTP on a Tailscale address, so on a phone across
  the tailnet the modern API is simply absent. If HTTPS ever arrives the first
  path starts winning by itself. Do not "modernise" this by deleting the
  fallback.
- **Pin the player's own leaderboard row.** `Leaderboard` shows the top ten; a
  player ranked #23 sees ten strangers and no sign of themselves. Their row
  belongs below an ellipsis when they fall outside the visible window (the rank
  is already known — `result.rank`).
- **Move the name prompt off the landing screen.** The name field sits between
  the prize showcase and the game list (`GamePicker.tsx`), so a kiosk phone pops
  a keyboard at the exact moment the customer has just been sold on a prize and
  is reaching for a game — the showcase made this worse, not better. Asking on
  the result screen, and only when the score actually lands on the board,
  removes the friction and asks at the moment the answer matters. Bigger flow
  change than it looks: the name is read from `?name=` before the round and
  travels with the submission, so it would have to become a post-submit rename.
- **Global + per-store leaderboards**, weekly resets, and "beat the staff score".
- **Offline-tolerant kiosk mode** with queued submissions.
- **Idle reset for kiosk mode** — a result screen left open should return to the
  picker after N seconds so the next customer starts clean.

## Platform / infrastructure

- **DynamoDB adapter** implementing `storage.Store` (the interface is ready) and
  a Postgres adapter for richer querying/analytics.
- **Caching** for the hot read paths (game catalog, leaderboards, and now the
  public prize showcase) with invalidation on write. The landing screen fetches
  prizes once per game (`state/usePrizes.ts`), which is two identical-for-everyone
  requests today and the obvious first thing to batch or cache as the catalog
  grows.
- **Observability** — structured logging, request tracing, metrics (play latency,
  error rates), health/readiness probes.
- **Containerization + IaC** for reproducible deploys; single-binary embed mode
  (serve both frontends from the Go binary on one port).
- **Feature flags** to roll games/campaigns out gradually.

## Follow-ups from shipped work

Concrete, near-term items surfaced while building the score-reveal flow, the
addressable result URL, and the admin award filters. Roughly ordered by how soon
they will bite. Each names the file it is a claim about, so it can be re-checked
rather than re-argued.

### Result URL polish

- **Per-game benchmark score.** The reveal meter is scaled against the current
  leaderboard leader, so on an empty board the player is their own benchmark and
  every round reads "Record breaker". Adding a `targetScore` to the game catalog
  (`domain.Game`, alongside `durationMs`) would give the tower a fixed, honest
  scale — exactly like a real strength tester — and fall back to the leaderboard
  only when unset.
- **Link previews for shared results.** Result URLs are now permanent and worth
  sharing, but the SPA serves the same empty `index.html` to every crawler, so a
  pasted link shows nothing. Needs a small server-rendered route emitting OG/
  Twitter meta tags (title = "Po scored 37 taps at Fun Store", image = the
  generated score card). This is the piece that makes the share feature above
  actually spread.
- **Rate-limit the public reads.** `GET /games/{slug}/scores/{id}` and
  `GET /games/{slug}/awards` are both unauthenticated, and the awards one is now
  hit on every landing-page load. Score ids are nanoid(11) — 66 bits, down from
  UUIDv4's 122 — so guessing one is still impractical, but the margin that made
  "enumeration is impossible" a throwaway line is smaller, and a per-IP limit
  belongs here before real prizes are on the line.
- ~~**Prize claim lifecycle is now one step away.**~~ — **built (backend), and
  the entry's own prediction was wrong.** It said this "only needs a status
  column". It needed a table: a claim is a credential with its own lifecycle,
  while a score is an immutable result, and seven fields bolted onto `scores`
  mixes them. It also needed *fewer* columns than predicted, not more — status
  is **derived** from `(redeemed_at, expires_at, now)` by `claim.StatusAt` and
  never stored, because a stored status disagrees with reality the moment a
  claim expires with nothing running to update the row. The knock-on: an admin
  list cannot be filtered in SQL (`claim.Filter` does it), which is a real
  constraint on the "admin lists at scale" section below.
- ~~**Deleting an award silently rewrites a player's history.**~~ — **fixed, by
  the first of the two routes this entry offered.** `claims.award_name` is a
  snapshot taken at issue time, so a deleted award no longer changes what a
  permanent result URL says was won (`TestClaimKeepsThePrizeNameAfterTheAwardIsDeleted`).
  Note the fix is **partial in a way worth naming**: it protects rounds that
  *won something*, because only those get a claim. A losing round has nothing to
  snapshot, and `Service.awardByID` still degrades a deleted award to "no prize"
  for anything issued before claims existed. Soft-delete/archive is still the
  complete answer, and still pairs with the audit-trail item below.
- **Backfill claims for wins that predate them.** Rounds already in
  `.prod/minigames.db` carry an `award_id` but no claim, so their result URLs
  show a prize with no code. A `cmd/backfill-claims` following the
  `cmd/migrate-ids` rules (dry-run default, `-apply`, timestamped backup,
  `-revert`) would close it. Until then the gap is silent.
- **A claim that fails to write is invisible to the player.** `app.issueClaim`
  logs and returns nil rather than failing the submission — deliberate, since
  the score is committed and the stock already spent by that point (see its
  comment), but the player sees a win with no code and no explanation. The
  counter-side repair path is the backfill script above; the player-side one is
  copy on the result screen that admits it.

### Admin lists at scale

Surfaced while building the award filters. Nothing here is wrong today — these
are the seams that give way as the catalog and the score table grow.

- **Award filtering is entirely client-side.** `AwardsPanel` fetches the whole
  unpaginated table via `listAwards()` and narrows it in `filterAwards`. Correct
  at a few dozen prizes, and it keeps the filter logic pure and unit-tested; but
  the URL already carries exactly the parameters a server-side query would need
  (`?game=&status=&stock=&q=&sort=`), so moving the work behind the API later is
  a swap of the data source, not a redesign of the panel.
- **The scores panel has no filters and a hard-coded `limit=25`.** `?game=` is
  the only parameter it honours — no date range, no pagination, and no way to
  find one player's rounds. That is fine for a leaderboard and useless for the
  question an admin will actually arrive with once prizes are claimable: "this
  customer says they won a coffee on Tuesday." **Now live rather than
  hypothetical** — prizes *are* claimable, and `GET /api/v1/admin/claims`
  answers the counter's version of that question by code. The scores panel
  still cannot answer it by person or by date.
- **The admin claims panel has no browser coverage.** `e2e/` starts the API and
  the PLAYER app only, so nothing exercises `ClaimsPanel.tsx` in a browser — the
  redeem box, the status filter and the row buttons are covered by unit tests on
  their pure parts (`admin-core/claims/present.ts`) and by nothing else. The
  player's claim code is E2E-tested; the counter's side of the same transaction
  is not. Adding the admin app to the Playwright `webServer` list is the fix,
  and it would also cover the awards and settings panels, which have the same
  gap and always have.
- **The native admin still has no claims screen.** `mobile/admin` remains a
  one-screen skeleton (awards list). A phone at a counter is exactly the right
  device for redeeming a code, and the API is ready for it; it needs its own
  Maestro flow, and the Maestro step only runs when a device is attached.
- **The claims list is unpaginated and filtered in memory.**
  `ClaimRepository.List` returns every claim ever issued and `claim.Filter`
  narrows it afterwards. That is forced rather than lazy — status is derived, so
  it cannot be a `WHERE` clause — but the endpoint's cost grows with total
  claims rather than with the size of the answer. Filtering `redeemed_at IS
  NULL` in SQL and deriving only *expiry* in memory would bound the scan without
  reintroducing a second definition of "redeemed"; worth doing before a venue
  accumulates a season of them.
- **Award delete has no audit trail.** The panel confirms, then deletes; nothing
  records who removed a prize or what its settings were. Pairs with "config
  change history" and with the soft-delete note above — one change buys both.

### Testing

- **Visual regression.** Every layout bug found during this work was purely
  visual (collapsed tier labels, a bell overlapping text, halo rings crossing a
  caption) — none of which a DOM assertion would catch. Playwright's
  `toHaveScreenshot()` would, but it needs a pinned container image for stable
  font/emoji rendering; deliberately deferred rather than half-done.
- ~~**Reveal timing is untested end-to-end.**~~ — **built**, and the entry was
  half wrong by the time it was: the animation can no longer be skipped at all.
  Both end-of-round stages were full-screen "tap to skip" buttons sitting exactly
  where a Tap Fast player's finger already is, so the tap-storm that ended a
  round routinely skipped the celebration *and* the reveal before the player
  registered either. `play-flow.spec.ts` now mashes the middle of the screen
  throughout and asserts a wall-clock floor on reaching the settled URL, which is
  the direct timing assertion this entry asked for.
- **The end-of-round duration is written down twice.** `COMPLETE_BEAT_MS` and
  `REVEAL_DURATION_MS` live in `packages/player-core/src/reveal/pacing.ts`, and
  `END_OF_ROUND_MS` in `e2e/helpers/round.ts` restates their sum as a literal —
  the e2e package sits outside the frontend workspace on purpose, so it cannot
  import them. The floor has 800ms of slack, so drift degrades the assertion
  quietly rather than failing it. A generated constants file, or reading the
  values off the page, would close it.
- **Every E2E round is now ~3.8s longer.** Six specs play a full round, so the
  unskippable sequence adds roughly 20s to the local gate. Acceptable today;
  if the suite grows, the reveal needs a test-only way to shorten the beats that
  is not the skip that was just removed — emulating `prefers-reduced-motion`
  already collapses both holds to zero (`holdMs`) and is the obvious lever.
- **iOS has no coverage whatsoever.** The Maestro suite
  (`mobile/admin/.maestro/`) is Android-only, and nothing in this repo has ever
  run on an iOS simulator — which also means the `NSAllowsLocalNetworking`
  exception in `app.config.ts` is *reasoned about* rather than *observed*. It
  needs a macOS runner, so it is deferred rather than half-done, but the ATS
  behaviour in particular should be confirmed on a real device before anyone
  relies on the iOS build.
- **The native suite can silently not run.** `ship.sh` skips the Maestro step
  when no emulator is attached. It says so, but a push from a machine without
  one still reports green — the same class of hole `SKIP_E2E` opens for the
  browser suite, and worth remembering before trusting a native change that was
  only ever compiled.

### Small cleanups

- **Duplicate session on mount in dev.** React StrictMode double-invokes effects,
  so `RoundRunner` requests two sessions per round locally (visible in the API
  log). Harmless — the second token wins and sessions expire — but it makes dev
  logs misleading and would matter if session creation ever costs something.
- **The won prize is the one place its image never shows.** `Award.imageUrl` now
  reaches the player — `PrizeShowcase` renders it with a 🎁 fallback — but
  `ResultSummary` still hands `HighlightCard` a hard-coded `icon="🎉"`, and the
  card has no image slot. So a customer sees the photo of the coffee while
  deciding whether to play, then wins it and gets an emoji. Giving
  `HighlightCard` an optional image (same fixed box as the showcase, so a
  missing one never shifts the layout) closes it.
