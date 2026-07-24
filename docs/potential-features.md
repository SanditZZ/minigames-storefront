# Potential features

Ideas worth considering as the experiment grows. Roughly ordered by leverage for
the stated goal (retention + engagement) and by how cleanly the current
architecture already supports them. Nothing here is committed.

## More mini-games (the core lever)

The registry pattern makes these cheap — one backend `Definition` + one player
component each:

- **Reaction Timer** — tap when the screen flips; score is reaction ms
  (`LowerIsBetter`, already supported by the reward/leaderboard code).
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

- **Localization (i18n)** — e.g. Thai/English toggle for storefront use.
- **Sound, haptics, and richer animations** for the reward reveal.
- **Accessibility** — larger tap targets, reduced-motion mode, screen-reader labels.
- **Global + per-store leaderboards**, weekly resets, and "beat the staff score".
- **Shareable win cards** for social proof.
- **Offline-tolerant kiosk mode** with queued submissions.

## Platform / infrastructure

- **DynamoDB adapter** implementing `storage.Store` (the interface is ready) and
  a Postgres adapter for richer querying/analytics.
- **Caching** for the hot read paths (game catalog, leaderboards) with
  invalidation on write.
- **Observability** — structured logging, request tracing, metrics (play latency,
  error rates), health/readiness probes.
- **Containerization + IaC** for reproducible deploys; single-binary embed mode
  (serve both frontends from the Go binary on one port).
- **CI** — run `go test`, `tsc -b`, and the frontend builds on every push.
- **Feature flags** to roll games/campaigns out gradually.
