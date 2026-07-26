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
- ~~**Precision Stop**~~ — **built, together with `targetScore`, exactly as this
  entry insisted.** A marker sweeps a track, the player stops it, and the score
  is the distance from centre (`LowerIsBetter`), so a perfect round scores 0.
  The prediction held: the game itself was cheap — one `game.Definition`
  (`catalog.go`), one component (`games/PrecisionStop.tsx`), one pure geometry
  module (`player-core/src/games/precision.ts`), and the reward side needed
  nothing, since `minScore: 5` already means "within 5 of centre" for a
  lower-is-better game. Everything expensive was the meter.

  **The fix was not the one this entry described.** It proposed a fixed scale so
  the leader stops being the denominator, and that shipped — but adding
  `targetScore` alone would have left the break intact for any game that lacked
  one. What actually closes it is a new pure `benchmarkFor`
  (`packages/player-core/src/reveal/calc.ts`) that **refuses a non-positive
  board leader as a scale** rather than passing it to `meterFraction`, so a
  perfect round can never become anyone's denominator, benchmark or no
  benchmark. `meterFraction`'s no-scale branch survives only as the
  new-client-old-server case.

  Two things worth keeping from the build:
  - **The invariant is enforced in Go, not hoped for in TypeScript.**
    `game.TestEveryGameDeclaresATargetScore` fails the build when a game is
    registered without a benchmark, which is what makes the client's fallback
    unreachable in practice instead of merely unlikely.
  - **The benchmark is the top prize's threshold** for all three games (see
    `app.starterAwards`), so "filled the tower" and "won the best prize" are the
    same event to a player rather than two unrelated scales. That is a
    convention held by a comment; nothing tests it.

  It is also the first game the **player** ends — Tap Fast and Reaction Timer
  both run until a timer fires — which is why it got its own browser test rather
  than only unit coverage.

  **And it needed a beat the other games do not.** Handing off on the same
  pointer event that ends the round meant the screen changed before the player
  could see where the marker actually stopped, which is the only thing they were
  aiming at. `STOP_HOLD_MS` (700ms, in `precision.ts`) freezes the track and
  names the landing first. Note it deliberately does **not** go through
  `pacing.holdMs`: that function collapses a beat to zero under reduced motion,
  which is right for the celebration and the reveal because those are motion,
  and wrong here because this beat is a readout that happens to be animated.
  A third beat now sits between the last input and the score, so the ending is
  the thing to watch if it starts to drag.
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
  counter and slow at a queue. Scoped as its own entry directly below, because
  the render is trivial and the scanner is not.
- **Scan-to-redeem: a QR on the result screen, a camera in the admin.** The
  counter flow today is a player reading eight characters aloud and an admin
  typing them into the redeem box (`ClaimsPanel.tsx`) — fine one at a time, slow
  at a queue, and every transcription is a chance to redeem the wrong claim,
  which is terminal (see "A redemption cannot be undone" below). Three parts,
  and they are worth separating because only two of them are hard:

  - **Render the claim code as a QR** on the result screen, beside the existing
    grouped code and copy button in `ClaimCard.tsx`. Pure rendering from data
    already on screen — no new API, no permissions, no secure context. This half
    works on the current plain-HTTP local stack as-is.
  - **Scan it in the admin**, filling the redeem box from the camera instead of
    the keyboard. Web: `getUserMedia` plus a decoder. Native: `expo-camera` in
    `mobile/admin`, which is the device that actually belongs at a counter and
    which currently has no claims screen at all (see the follow-up below).
  - **Confirm before redeeming, always.** A scan is a trigger a stray camera
    angle can pull, so it must land on "Redeem *Free Coffee* for `ABCD-2345`?"
    rather than on the POST. This is not UI polish: `POST
    /api/v1/admin/claims/{code}/redeem` has no inverse, so a mis-scan is
    unrepairable outside SQLite.

  **Deciding what the QR encodes is the security question, not a detail.** The
  bare code keeps the blast radius where it is. A deep link into the admin
  (`/claims?code=…`) is faster for staff and turns the prize credential into a
  URL, which spreads the way the "score id is a bearer capability" entry below
  describes. Prefer the bare code until claims have owners.

  **Testing it on the local stack is the part that will bite**, so plan for it
  before building:

  - `navigator.mediaDevices` is **undefined on an insecure origin**, exactly like
    `navigator.clipboard` (see "Copying works without a secure context" below).
    `scripts/serve-prod.sh` serves plain HTTP on the Tailscale IP, so the web
    scanner is not merely awkward to test across the tailnet — the API it needs
    is absent. `localhost` *is* a secure context, but this box is headless and
    has no camera, so that exemption buys nothing.
  - The clean fix is real HTTPS on the tailnet (`tailscale cert` / `tailscale
    serve` issue a genuine cert for the `*.ts.net` name), which would also let
    the clipboard's modern path start winning by itself. Chrome's
    `--unsafely-treat-insecure-origin-as-secure` works per-device for a dev
    phone and is not a deployment.
  - **The native admin sidesteps all of it.** `expo-camera` asks the OS for
    permission and is not bound by web secure-context rules — only by the
    cleartext/ATS exceptions `mobile/CLAUDE.md` already documents for the API
    call. If scan-to-redeem is built once, the phone is the honest place.
  - For the browser suite, Playwright can feed a fake camera
    (`--use-fake-device-for-media-stream --use-file-for-fake-video-capture`) with
    a pre-rendered QR video, so the scan path is testable without hardware —
    but `e2e/` does not start the admin app at all yet, which is a prerequisite
    listed under "Admin lists at scale".
  - Decoding in the browser needs a dependency decision: `BarcodeDetector` is
    Chromium-only, so portable decoding means shipping a wasm/JS decoder into an
    app whose only runtime dependency today is React.
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
- **Claim codes are bearer tokens, and nothing enforces one holder.** Now that
  the lifecycle is built, this section's heading applies to it directly: a code
  works for whoever types it, so a screenshot forwarded to a friend is as good
  as the original. Redemption is single-use, which caps the damage at one prize
  per win rather than one per screenshot — that *was* the point — but it does
  not make the code personal. Binding it to a customer identity is the fix, and
  it is blocked on the identity section above.

## Admin & operations

- **Real auth** — replace the shared secret with user accounts, roles
  (admin/staff), and audit logs of who changed which award/setting.
  **Redeeming a claim raised the stakes here.** Handing over a prize is the
  first admin action that is a transaction with a customer rather than a config
  edit, and it is the one most likely to be disputed later ("I never collected
  that"). `claims.redeemed_at` answers *when* and can never answer *who*, so
  until this lands the audit trail for the app's most contested action is a
  timestamp and a shared password.
- **Analytics dashboard** — plays, win rate, prize burn-down, cost per
  engagement, funnel from purchase → play → claim. **The last step of that
  funnel is now measurable** — `claims` records issued vs redeemed vs expired,
  so "how many prizes did we actually hand over?" is a query rather than a
  guess. It was the missing piece when this entry was written; the rest of the
  funnel still is not instrumented.
- **Award image uploads** (currently a URL field) with storage + CDN.
- **Store logo upload.** An admin picks an image; the player app shows it where
  `PageHeader` currently renders the brand wordmark (`PageHeader.tsx` already
  says in its own comment that a logo should be able to replace the text "in one
  edit", so the seam exists). Three things this repo does not have yet, worth
  knowing before it is scoped as small:
  - **There is no file handling anywhere in the backend.** No `multipart` parse,
    no `http.FileServer`, no `ServeFile` — grep confirms it. This is a new
    capability with its own size limits, content-type allowlist and filename
    sanitising, not a new field on an existing handler.
  - **Storage should be an interface from the first commit, and the repo already
    has the pattern to copy.** `storage.Store` is an interface whose only
    implementation is SQLite, which is exactly what makes "DynamoDB adapter"
    above a drop-in. A `BlobStore` with `Put`/`URL`/`Delete` and a `localfs`
    implementation gives S3 the same treatment: a sibling package, no caller
    changes. Local files go under `.prod/uploads/` — **already gitignored**,
    since `.gitignore` ends with `.prod/`; anywhere else needs a new rule and
    will eventually be committed by accident.
  - **The served URL is the trap.** `serve-prod.sh` bakes an absolute API base
    into the frontend bundles, so a stored `/uploads/logo.png` resolves against
    the *player* origin (port 3000), not the API (8081), and silently 404s
    across the tailnet. Whatever `BlobStore.URL` returns has to be absolute for
    the same reason the API URL is.

  Do this once for both this and the award images above — they are the same
  problem, and `PrizeImage.tsx` is already the shared render primitive.
- ~~**Store identity editable from the admin: name, tagline, colours.**~~ —
  **built, all three.** Renaming or recolouring the shop used to be a code edit
  and a `ship.sh` run, which is fine for one store and absurd for two; it is now
  a form — `StoreBranding.tsx` in the settings panel, with the admin app wearing
  the store's own colours so choosing one is a preview rather than a guess. The
  split below is kept because it is why the three were never one feature, and
  because each part cost something different:
  - ~~**Name and tagline are easy and blocked on one missing endpoint.**~~ —
    **built.** `GET /api/v1/settings/public` serves a flat key→value map, and
    the allowlist that decides what appears in it is its own calculation package
    (`internal/settings`), pinned by a test to *exactly* `store_name` and
    `store_tagline` so publishing a third knob cannot be a one-line slip. The
    player resolves the pair through `storeIdentity` (`player-core/brand.ts`),
    which falls back **per field** — a store with a name and no tagline keeps its
    name — so `BRAND_NAME`/`BRAND_TAGLINE` survive as the offline fallback
    rather than the source. What the entry underestimated: the response shape is
    a decision, not a detail. Returning `Setting[]` would have handed players
    the operator-facing `description` and `updatedAt` of every public key; the
    narrower map is what keeps the allowlist meaning something.
  - ~~**Colours fight the token pipeline.**~~ — **built, and the premise was
    wrong.** Tailwind v4 does not bake the palette in: `bg-brand` compiles to
    `background-color: var(--color-brand)`, so redefining that property on the
    root element re-colours every utility with no rebuild — verified against the
    built bundle before any of this was written. The split landed as the entry
    predicted even so: `paletteCssVars`/`resolvePalette`
    (`packages/tokens/src/override.ts`) decide *which* colours apply and are
    shared with native, while a ~15-line `useBrandPalette` in each app is the
    only thing that touches `document`.
    **"Which one wins" is answered in one line, at the top of `override.ts`:**
    the tokens are the palette; a setting that is present AND a valid colour
    overrides one; anything else is not an override. The colour settings are
    deliberately **not seeded** — seeding them would pin every store's palette
    at whatever it was the day its database was created, and a token change
    would silently reach nobody. The cost of that choice, stated so it is not a
    surprise: an operator who sets a colour has opted out of future token
    changes for it until they clear it, which is why the admin offers a reset
    and not only an edit box.
    **Two things the entry did not anticipate.** A colour needed its own
    `SettingType` (`domain.SettingColor`, validated by `settings.IsHexColor`) —
    a string type would have accepted `url(https://…)`, valid CSS that would
    have every player's browser fetch a third-party asset, since the value lands
    in a live custom property. And opacity utilities (`text-ink/70`) compile to
    a `color-mix()` over the same variable *behind an `@supports` guard*, with a
    baked hex fallback: on a browser without `color-mix` the solid shades
    re-colour and the translucent ones do not.
  - ~~**Nothing currently guards the palette from drifting.**~~ — **built**, and
    deliberately ahead of the colours it protects. `npm run theme:check` is now
    the first frontend step in both `scripts/ship.sh` and
    `.github/workflows/ci.yml`, so a hand-edited `theme.css` fails the build
    instead of surviving until someone regenerates.
  - ~~**A refresh control on the player.**~~ — **built**, though not where this
    entry expected. The landing hero is `PageHeader`, not `HeaderRow`, so the
    anti-overlap rule had to be applied to a *centred* header: `PageHeader` grew
    an `action` slot laid out as spacer / hero / action, the spacer mirroring the
    button's width so the hero stays optically centred and the name still
    truncates rather than shoving the button off a 320px screen. The button is a
    new kit primitive, `IconButton`, whose `label` prop is **required** — an
    icon-only control with no accessible name is the one accessibility bug a
    compiler can prevent. One gesture reloads the catalog and the settings
    together (`App.reload`), because "the games are stale but the name is not"
    is not a state worth explaining. Still pairs with **"Idle reset for kiosk
    mode"** below: a timer returning to the picker should refetch on the way.
  - Note the cost side: this adds another per-load public fetch, joining the
    three prize requests the **Caching** entry already flags.
  - **Nothing checks that a chosen palette is legible.** `frontend/CLAUDE.md`
    states the contrast rules the tokens were picked to satisfy — ink on light
    surfaces, *never* white text on the pastels — and an operator can now set
    all five colours to anything that parses as hex. Cream text on a cream
    background is two saves away, and the only feedback is the admin repainting
    itself the same way. The fix is a pure contrast-ratio check next to
    `isHexColor` (`packages/tokens/src/override.ts`): compute WCAG contrast for
    the pairs the rules actually name — `ink` on each of `brand`…`brand-4`, and
    `ink` on white — and warn in `StoreBranding.tsx` below 4.5:1. Worth doing as
    a warning rather than a block: a venue's real brand colour is not negotiable
    with a validator, and refusing to save it would just get the palette set by
    hand in SQLite. This bites the first time a store picks its own colours,
    which is the feature's entire purpose.
  - **The palette arrives after the first paint.** `usePublicSettings` fetches on
    mount, so a player sees the built-in tokens for one request and then the
    store's colours — a visible flash on a cold load, worst on the landing screen
    where the whole background is a `from-brand-4 to-brand-3` gradient. Options,
    cheapest first: cache the last-known palette in `localStorage` and apply it
    synchronously before the fetch resolves (an app-layer concern, next to
    `useRouter`); or have `serve-prod.sh` bake the current palette into the
    bundle's `theme.css` at deploy time, which reintroduces the drift the
    read-time override was chosen to avoid. It bites on every cold load, but is
    invisible on the kiosk phones that never reload — which is why it is filed
    rather than fixed.
  - **Only the landing screen knows the store's name.** `usePublicSettings` is
    called once, in `App.tsx`, and the identity is passed down to `HomeScreen`
    alone; `ResultScreen` and `PlayScreen` never receive it. That is correct
    today — they display no branding — but it is exactly the wrong shape for the
    next three things that want it: the shareable score card (**Share score
    photo**, below) renders the store name onto an image, the store logo will
    want to sit on more than one screen, and a runtime palette has to apply to
    the whole document rather than one route. Lifting it into a context, or
    resolving it once in `App` and passing it everywhere, is a small change now
    and a tangled one after the logo lands. It bites the moment a second screen
    needs identity — which the very next feature on this list does.
- **Config change history** and one-click rollback for settings/awards.
- **A/B testing** thresholds and reward mixes to optimise retention.

## Player experience

- **Share score photo** — a "Share" button on the result screen that generates an
  image of the player's score, decorated with the store theme and name — which is
  now an admin setting, so read it from `storeIdentity`
  (`packages/player-core/src/brand.ts`) rather than the `BRAND_NAME` fallback, or
  every shared card will say "Fun Store" whatever the shop is called. Note the
  result screen does not fetch settings today: only the landing screen does, so
  this needs the identity lifted or refetched there. Render the card to a `<canvas>` from
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
  - ~~**Errors are not announced.**~~ — **built**, and it needed one decision
    the entry did not anticipate. `StatusMessage` is the *only* full-screen
    message state, so blanket `role="alert"` would have made "Page not found"
    interrupt whatever a screen reader was saying. It now takes
    `tone: "info" | "error"`: failures announce assertively (`role="alert"`),
    dead ends the player navigated to themselves announce politely
    (`role="status"`). Two of the six call sites are real failures — the games
    fetch (`HomeScreen`) and the failed submit (`RoundRunner`, the one this
    entry was about). The region wraps the copy only, not the emoji
    (`aria-hidden` already) or the action, whose label is read as a button.
    The admin's equivalent surface was already fine: `Alert` in
    `admin/src/ui/Surface.tsx` has carried `role="alert"` all along, so the
    silence was the player app's alone.
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
  prizes once per game (`state/usePrizes.ts`), which is **three**
  identical-for-everyone requests since Precision Stop landed — it was two when
  this was written, and that is the point: the cost is per game, so every new
  game makes the landing page slower for everyone. The obvious first thing to
  batch or cache.
  **Store identity added a fourth, and it is a different shape.**
  `state/usePublicSettings.ts` fetches `GET /api/v1/settings/public` on mount and
  again on every refresh-button press, and unlike the prize calls it does not
  grow with the catalog — it is one request whose response is the same handful of
  bytes for every player in the venue, changing perhaps twice a year. That makes
  it the cheapest possible thing to serve from an `ETag` or a short
  `Cache-Control: max-age`, and the one where the refresh button gives the
  argument its edge case: a cache the operator cannot bust from the player's own
  reload control would make the button lie.
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

- ~~**Per-game benchmark score.**~~ — **built**, shipped in the same change as
  Precision Stop as this entry demanded. `domain.Game.TargetScore` sits beside
  `DurationMs`, persisted by migration `004_game_target_score.sql`; the client
  reads it through `benchmarkFor`, which prefers it and falls back to the
  leaderboard only when it is unset. The empty-board "Record breaker" is gone
  along with the permanent break.
  **What it cost that the entry did not anticipate:** a benchmark is a *catalog*
  value, so it started out editable only by changing Go and redeploying — an
  admin could tune the claim TTL and the anti-cheat limits from `SettingsPanel`
  but not the number the reveal is measured against. That gap is now closed by
  the read-time override below; the benchmark is still catalog data, with the
  operator's value layered over it.
- ~~**A game's benchmark is not admin-tunable.**~~ — **built**, and the entry's
  two candidate shapes were both wrong in the same way. It said "a settings-backed
  override read by `Seed`, or an admin games panel"; the override is
  settings-backed but is applied **on read**, not by `Seed`, because `Seed` runs
  once at boot and an override it wrote would need an API restart to take
  effect — which defeats the point of not needing a deploy.
  `settings.ApplyTargetScores` layers the override over the registry in
  `app.ListGames`/`GetGame`/`HighScores`, so the catalog keeps saying what the
  *code* thinks a benchmark is and clearing the setting restores it with nothing
  to migrate. The panel is a card in settings (`GameBenchmarks.tsx`), not a
  games panel. Zero is rejected rather than treated as a clear, because zero
  already means "unset" to the client and would switch the leaderboard-leader
  fallback back on by accident.
  **What it cost that the entry did not anticipate:** the handlers were reading
  `Registry()` directly, so `GET /api/v1/games` and the leaderboard's embedded
  game had to be routed through the service or they would have served the
  untuned number from one endpoint and the tuned one from another.
- ~~**The benchmark/top-prize convention has no test.**~~ — **built.**
  `TestBenchmarkMatchesHardestStarterAward` (`internal/app/seed_test.go`) walks
  every registry game and asserts its `TargetScore` equals the `MinScore` of its
  hardest starter award, reading each game's `ScoreDirection` rather than
  assuming — tap-fast's hardest prize carries the largest threshold, the two
  lower-is-better games the smallest. **It does not close the case the entry
  actually named.** The test covers the *seeded* ladder; an admin editing an
  award afterwards still breaks the convention silently, and now so does an
  admin retuning a benchmark from the card above. Both are live edits, so
  catching them needs a check at write time (or a warning in the admin when the
  two disagree), not a unit test.
- **Precision Stop's score cannot be verified server-side, and its validator
  says so.** `validatePrecisionStop` bounds-checks (`0 <= value <=
  PrecisionTrackHalf`) and stops there, because the marker's starting phase is
  drawn on the client (`PrecisionStop.tsx`, `phaseRef`), leaving the server no
  shared secret to recompute a stop position from. Tap Fast has a
  physiological ceiling and Reaction Timer a physiological floor; this game has
  neither, so a fabricated `0` is indistinguishable from a perfect round. It is
  the first game where **"server-authoritative scoring"** in the anti-abuse
  section buys something concrete: sending the phase seed with the session and
  the stop timestamp with the score would make it checkable.
- **`reactionVerdict` is written, exported, and rendered nowhere.** It grades a
  reaction ("Lightning", "Sharp", "Solid"…) and nothing displays it — the
  reveal's tier ladder took over the job of grading a round. Its twin
  `precisionVerdict` was in the same state for about an hour: adding the
  post-stop hold to Precision Stop gave it a surface (the track's readout, where
  it names the landing before the score reveal opens), which is the argument for
  what to do with this one. Either every game gets a moment that grades the
  round in its own vocabulary, or the verdict helpers go and the tier ladder is
  the only voice.
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
  **Claim codes changed what a score id is worth.** `ScoreResult` returns the
  claim, and `GET /games/{slug}/scores/{id}` is unauthenticated — verified: the
  full code comes back with no admin token. That is not a bug to patch, it is
  the design: a player has no account, so the unguessable result URL is the only
  way to show them their own code. But it makes the score id a **bearer
  capability for a prize** rather than a name for a public leaderboard row, and
  nothing in the app treats it that way yet. The consequences are all in where
  URLs leak rather than in guessing: shared links, browser history on a borrowed
  phone, screenshots, a `Referer` header to any third party the result page ever
  loads. Worth deciding deliberately before prizes have value — the options are
  rate-limiting (cheap, partial), omitting the code unless the request proves it
  owns the round (correct, needs a token minted at submit time), or accepting it
  explicitly and writing down that a result URL is as sensitive as the prize.
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
- **Changing the claim TTL does not move existing claims.** `app.issueClaim`
  reads `claim_ttl_hours` once and stamps the result into `claims.expires_at`
  (`service.go:264`), so the setting only governs claims issued afterwards. That
  is the right storage model — a claim's deadline should not move under the
  person holding it — but `SettingsPanel` renders every setting the same generic
  way, so an admin shortening the window sees a knob that looks retroactive and
  is not. The fix is copy on that setting, not a change to the data.
- **A redemption cannot be undone.** The only write is
  `POST /api/v1/admin/claims/{code}/redeem`; there is no inverse. A code
  redeemed by mistake — a mistyped lookup that happened to hit a real claim, a
  customer who walked off before collecting — is terminal, and the only repair
  is editing SQLite by hand. An un-redeem action (admin-only, and itself
  audited) is the obvious pair to the audit-trail item below.
  **Scan-to-redeem makes this a prerequisite rather than a nicety.** Typing a
  wrong code that happens to collide with a real claim is unlikely; a camera
  pointed at the wrong screen is not, which is why that entry insists on a
  confirmation step — and why the inverse should exist before the trigger gets
  that much easier to pull.
- **`redeemed_at` records when, never who.** The claims table has no actor
  column (`003_claims.sql`), and the admin API is one shared secret with no
  identities behind it, so "who handed this prize over?" is unanswerable by
  construction. Same root cause as the award-delete audit gap below, and the
  same fix buys both: admin identities, then an audit log.
- ~~**The admin's token field has no label.**~~ — **built**, one `aria-label`
  on `TokenGate.tsx`, exactly as the entry predicted. The sweep it suggested
  found everything else labelled — inside `Field` (`AwardForm`,
  `NewSettingForm`), wrapped in its own `<label>` (`AwardFilters`), carrying an
  `aria-label` (`ScoresPanel`, the claims status filter) or an `id` its label
  points at (`ClaimsPanel`'s redeem box) — **except one**, below.
- **The settings row's value editor is unlabelled.** `SettingRow` renders
  `<ValueInput>` bare (`SettingsPanel.tsx:89`); the setting's key sits next to it
  in a `<code>` element that nothing associates with the control, so a screen
  reader hears an edit box with no name, once per setting. Unlike the token gate
  this is not a one-attribute fix: `ValueInput` is not given the key it would
  need to name itself, so it wants a `label` prop threaded from the row. Found
  while sweeping for the entry above; deliberately left rather than folded into
  it.
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
  **It is also the only client that can scan one.** `expo-camera` is not subject
  to the web's secure-context rule, so the phone is where scan-to-redeem works
  without first putting HTTPS on the tailnet — see that entry under "Reward
  system depth". The Maestro caveat cuts the other way, though: a camera flow is
  precisely what a device-less CI run cannot verify.
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

- **The rename never happens in a browser.** Store identity is covered by
  `settings/public_test.go` (the allowlist), `player-core/src/brand.test.ts` (the
  fallbacks) and a `curl` — every part of it except the one that matters to an
  operator: that editing `store_name` in the admin changes what the player's
  header says. `play-flow.spec.ts` reads the landing screen already and asserts
  nothing about the header, so the gap is one assertion wide *if* the admin app
  is driven too — and it is not, which is the same prerequisite the admin claims
  panel entry above is blocked on. Until then the whole feature is verified by
  unit tests either side of a wire nobody crosses in anger.
  **The palette made this worse, not equally bad.** A rename that fails to
  apply is a wrong word on one line; a palette that fails to apply is the whole
  app in the wrong colours, and the mechanism is a CSS custom property written
  to `document.documentElement` — the one part of the feature that is *only*
  exercisable in a real browser, and the one part no test touches.
  `useBrandPalette` in each app has no coverage of any kind: the pure resolver
  under it does, and the DOM write does not. One Playwright assertion that
  `--color-brand` on the root element equals a value set through the API would
  cover both apps' copies at once.
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
  unskippable sequence adds roughly 20s to the local gate. **That count is
  already stale and the entry is the reason to re-derive it rather than trust
  it** — `playRound` has ten call sites across `play-flow.spec.ts` and
  `result-url.spec.ts` today, plus the new Precision Stop test, which reaches
  the same sequence by a different route (it ends the round on a tap instead of
  waiting out a clock). The cost grows every time a game is added.
  Acceptable today;
  if the suite grows, the reveal needs a test-only way to shorten the beats that
  is not the skip that was just removed — emulating `prefers-reduced-motion`
  already collapses both holds to zero (`holdMs`) and is the obvious lever.
- ~~**The suite produced its first flake, and it was blamed on the wrong
  thing.**~~ — **fixed, and the first guess written here was wrong**, which is
  the part worth keeping. The run that shipped the post-stop hold reported
  `play flow › a winning round hands the player a claim code` as flaky: a 60s
  test timeout, passing on the single retry. This entry originally called it the
  suite's own slack running out as games are added — plausible, adjacent to a
  real entry above it, and false.
  **Two measurements killed it.** The test runs in 11.5–12.1s over eight
  consecutive samples, so 60s is 5× its honest duration rather than drift; and
  subtracting the timeout plus its retry from the slow run leaves the other 18
  tests at 126s, against 132s for 19 tests in the clean run — the rest of the
  suite was not slower at all. One call stalled.
  **The cause was a Playwright default, not this repo's pacing.**
  `Locator.dispatchEvent` has *no* action timeout unless one is configured, so
  the tap loop in `helpers/round.ts` — which dispatches to a "TAP!" button that
  unmounts the instant the round ends — waited for the test timeout whenever the
  round ended in the few-ms window between its `isVisible()` check and the
  dispatch resolving. The `.catch(() => {})` on that dispatch then swallowed the
  teardown error, so the failure was reported against the `waitForTimeout` on
  the next line. A catch written to absorb an unmount hid the stall instead.
  Fixed on both layers: `actionTimeout: 5_000` in `playwright.config.ts` so no
  action can ever consume a test budget again, and an explicit `{ timeout }` on
  that one dispatch. **The general lesson outlives the bug** — every `.catch()`
  in this suite is a candidate for the same disguise, and an unbounded default
  turns "fails fast and says why" into "fails late and blames its neighbour".
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
  only ever compiled. **It skipped on every push in the session that built the
  claim lifecycle** — four ships, zero native runs — which is the shape the
  problem actually takes: not one forgotten check, a standing one.

### Small cleanups

- **Duplicate session on mount in dev.** React StrictMode double-invokes effects,
  so `RoundRunner` requests two sessions per round locally (visible in the API
  log). Harmless — the second token wins and sessions expire — but it makes dev
  logs misleading and would matter if session creation ever costs something.
- ~~**The won prize is the one place its image never shows.**~~ — **built**, and
  the entry named the wrong component. `HighlightCard` did need an optional
  `imageUrl`, but that card only renders the *rare* win — the one where issuing
  the claim failed. Every normal win goes through `ClaimCard`, which is not a
  `HighlightCard` at all and had its own hard-coded 🎉/🎟️. Fixing only what the
  entry named would have left the emoji on the path virtually every winner
  takes.
  The fixed box is now a kit primitive (`ui/PrizeImage.tsx`) used by all three
  surfaces, so the showcase and the result screen cannot drift apart. Two
  decisions worth keeping: the image is read from the **live** award while the
  name still comes from the claim's snapshot — a deleted prize drops to the
  emoji rather than rewriting what was won — and a redeemed or expired claim
  renders it `muted` (grayscale), because the photo is still what was won but
  should not compete with the live parts of the screen.
