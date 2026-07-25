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
- **Prize claim lifecycle** — issue a claim code/QR, mark redeemed at the
  counter, expire unclaimed prizes. Prevents screenshot reuse.
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
  - **The revealed score is never announced.** `RevealMeter` is correctly
    `aria-hidden`, but the number beside it (`ScoreReveal.tsx`) is a plain
    `<div>` inside a button labelled "Revealing your score. Tap to skip." — so a
    screen-reader user is told the reveal is happening and then never hears the
    result. It needs an `aria-live="polite"` region announcing the settled value
    once, not the count-up (which would babble every frame).
  - **Errors are not announced.** `StatusMessage` renders failures as ordinary
    text with no `role="alert"`, so a failed submit is silent.
- **Scope the no-select rule.** `index.css` sets `user-select: none` on `body`
  to stop text selection during rapid tapping, which also means a player cannot
  copy their score — and will not be able to copy a claim code once the prize
  lifecycle lands. It should apply to the game surfaces rather than globally.
- **Pin the player's own leaderboard row.** `Leaderboard` shows the top ten; a
  player ranked #23 sees ten strangers and no sign of themselves. Their row
  belongs below an ellipsis when they fall outside the visible window (the rank
  is already known — `result.rank`).
- **Move the name prompt off the landing screen.** The name field currently sits
  between the hero and the game list, so a kiosk phone pops a keyboard before
  the customer has decided to play anything. Asking on the result screen — and
  only when the score actually lands on the board — removes the friction and
  asks at the moment the answer matters. Bigger flow change than it looks: the
  name is currently read from `?name=` before the round and travels with the
  submission, so it would have to become a post-submit rename.
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

## Follow-ups from the reveal + routing work

Concrete, near-term items surfaced while building the score-reveal flow and the
addressable result URL. Roughly ordered by how soon they will bite.

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
- **Prize claim lifecycle is now one step away.** Scores persist the `award_id`
  they won, so "issue a claim code, mark redeemed at the counter, expire
  unclaimed" only needs a status column and an admin action — no schema rework.
  Today's "show this screen at the counter" is still screenshot-reusable.

### Testing

- **Visual regression.** Every layout bug found during this work was purely
  visual (collapsed tier labels, a bell overlapping text, halo rings crossing a
  caption) — none of which a DOM assertion would catch. Playwright's
  `toHaveScreenshot()` would, but it needs a pinned container image for stable
  font/emoji rendering; deliberately deferred rather than half-done.
- **Reveal timing is untested end-to-end.** The maths is unit-tested and the flow
  is E2E-tested, but "the animation lasts about 2.2s and can be skipped" is only
  covered indirectly. A trace-based assertion could pin it if the feel starts
  regressing.

### Small cleanups

- **Duplicate session on mount in dev.** React StrictMode double-invokes effects,
  so `RoundRunner` requests two sessions per round locally (visible in the API
  log). Harmless — the second token wins and sessions expire — but it makes dev
  logs misleading and would matter if session creation ever costs something.
- **Award image URLs are unused by the player.** `Award.imageUrl` is admin-editable
  and rendered nowhere; the prize card shows an emoji. Either show it or drop the
  field (it pairs with "Award image uploads" above).
