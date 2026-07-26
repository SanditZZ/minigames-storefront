# Potential features

Ideas worth considering as the experiment grows. Roughly ordered by leverage for
the stated goal (retention + engagement) and by how cleanly the current
architecture already supports them. Nothing here is committed.

**This file holds only what is NOT built.** A shipped feature's entry is
deleted, not struck through — see the roadmap rules in the repo-root
`CLAUDE.md`. What a build settled lives beside the code it settled it for; what
it *proved* lives in `git log`. If you want to know why something works the way
it does, read the comment on the symbol, not this file.

Every entry names the file it is a claim about, so it can be re-checked rather
than re-argued.

## More mini-games (the core lever)

The registry pattern makes these cheap — one backend `Definition`
(`internal/game/catalog.go`), one player component (`apps/player/src/games/`),
and one pure module in `packages/player-core/src/games/` for whatever maths the
game has. Two things a new game must do rather than may:

- **Declare a `TargetScore`.** `game.TestEveryGameDeclaresATargetScore` fails the
  build without one, which is what keeps the reveal meter's no-benchmark
  fallback unreachable in practice.
- **Translate its own name, description and score unit** in
  `internal/game/i18n.go` — the server owns those strings and the client never
  re-derives them.

Games worth building:

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

  - `navigator.mediaDevices` is **undefined on an insecure origin**, for exactly
    the reason `apps/player/src/clipboard/copy.ts` documents at length for
    `navigator.clipboard`. `scripts/serve-prod.sh` serves plain HTTP on the
    Tailscale IP, so the web scanner is not merely awkward to test across the
    tailnet — the API it needs is absent. `localhost` *is* a secure context, but
    this box is headless and has no camera, so that exemption buys nothing.
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
    a pre-rendered QR video, so the scan path is testable without hardware. The
    admin app is already a `webServer` in `e2e/stack.ts` (port 5298) and
    `tests/admin-claims.spec.ts` already drives the redeem box, so a scanner
    filling that box has somewhere to be tested. What remains unmet is the
    secure-context problem two bullets up — a fake camera does not conjure
    `navigator.mediaDevices` onto an insecure origin.
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
- **Claim codes are bearer tokens, and nothing enforces one holder.** A code
  works for whoever types it, so a screenshot forwarded to a friend is as good
  as the original. Redemption is single-use, which caps the damage at one prize
  per win rather than one per screenshot — that *was* the point — but it does
  not make the code personal. Binding it to a customer identity is the fix, and
  it is blocked on the identity section above.

## Admin & operations

- **Real auth** — replace the shared secret with user accounts, roles
  (admin/staff), and audit logs of who changed which award/setting.
  **Redeeming a claim is what raises the stakes here.** Handing over a prize is
  the one admin action that is a transaction with a customer rather than a config
  edit, and the one most likely to be disputed later ("I never collected that").
  `claims.redeemed_at` answers *when* and can never answer *who*, so until this
  lands the audit trail for the app's most contested action is a timestamp and a
  shared password. A shared secret sitting in a staff phone's keychain
  (`mobile/CLAUDE.md`) is weaker still than one in a browser tab that gets
  closed.
- **Analytics dashboard** — plays, win rate, prize burn-down, cost per
  engagement, funnel from purchase → play → claim. The last step is the only one
  instrumented: `claims` records issued vs redeemed vs expired, so "how many
  prizes did we actually hand over?" is a query. Everything before it is a guess.
- **Nothing ever reclaims an orphaned upload.** Replacing an award's image or the
  store logo overwrites the URL and leaves the previous file on disk forever;
  `DELETE /api/v1/admin/uploads/{name}` exists and no UI calls it. Deleting on
  replace would need to know the old URL was ours *and* that nothing else
  references it, which is reference counting — the honest fix is a sweep that
  lists objects, subtracts every URL mentioned by an award or a setting, and
  deletes the rest, run from `cmd/` under the repo's script rules (dry run by
  default, timestamped backup, `-apply`). Each orphan is bounded by
  `blob.MaxUploadBytes` (2 MiB), so this is disk creep rather than a leak: it
  bites a store that re-photographs its prize list a few hundred times, not one
  that sets a logo once.
- **There is no CDN, and the API serves image bytes.** Objects go out with
  `Cache-Control: immutable` — safe, because a replacement mints a new name — so
  a browser fetches each one once, but every cold visit hits the Go process,
  which served nothing but JSON before uploads landed. Fine for one venue; the
  fix when it stops being fine is an S3 implementation of `blob.BlobStore` (the
  interface was shaped for it, and serving is a separate optional
  `blob.HTTPServed`), not a cache bolted in front of `localfs`.
- **The cropper's canvas has no browser test.** `packages/image-core` is
  unit-tested — cover scale, pan clamp, the preview→output map — but
  `apps/admin/src/components/PhotoEditor.tsx`, which is the canvas and pointer
  half, is covered by nothing. The admin app *is* reachable to Playwright now
  (`e2e/stack.ts`, port 5298), so the old excuse is gone; what remains is that
  asserting on canvas pixels needs either a pinned rendering environment or a
  readback of the exported blob's dimensions. The latter is cheap and worth
  doing: it would catch an export that does not match the preview, which is the
  bug class the geometry was extracted to prevent.
- **Nothing checks that a chosen palette is legible.** `frontend/CLAUDE.md`
  states the contrast rules the tokens were picked to satisfy — ink on light
  surfaces, *never* white text on the pastels — and an operator can set all five
  colours to anything that parses as hex. Cream text on a cream background is two
  saves away, and the only feedback is the admin repainting itself the same way.
  The fix is a pure contrast-ratio check next to `isHexColor`
  (`packages/tokens/src/override.ts`): compute WCAG contrast for the pairs the
  rules actually name — `ink` on each of `brand`…`brand-4`, and `ink` on white —
  and warn in `StoreBranding.tsx` below 4.5:1. Worth doing as a warning rather
  than a block: a venue's real brand colour is not negotiable with a validator,
  and refusing to save it would just get the palette set by hand in SQLite. This
  bites the first time a store picks its own colours, which is the feature's
  entire purpose.
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
  rather than fixed. `index.html`'s hardcoded `lang="en"` has the same shape and
  the same one-frame cost, and wants fixing in the same change.
- **Only the landing screen knows the store's identity.** `usePublicSettings` is
  called once, in `App.tsx`, and the identity is passed down to `HomeScreen`
  alone; `ResultScreen` and `PlayScreen` never receive it. That is correct today
  — they display no branding — but it is exactly the wrong shape for the next
  three things that want it: the shareable score card (**Share score photo**,
  below) renders the store name onto an image, the store logo will want to sit on
  more than one screen, and a banner (next entry) will want the result screen
  too. Lifting it into a context, or resolving it once in `App` and passing it
  everywhere, is a small change now and a tangled one afterwards.
- **A square logo and a full-width cover banner — two images, two shapes, two
  jobs.** The store has one image today (`store_logo_url`, rendered by
  `PageHeader` as `max-h-12 w-auto object-contain`), and it has to be both the
  mark and the whole visual identity of the header. That is one image doing two
  jobs badly: a wide wordmark and a square badge push the headline down by
  different amounts, and neither fills the top of the screen the way a venue's
  own photography would.
  - **Square + rounded for the mark.** Constrain `store_logo_url` to a square
    render (`aspect-square object-cover rounded-2xl`) so every store's header
    is the same height whatever they upload. The cropper already exists and is
    already pure — `packages/image-core` computes cover scale, pan clamp and the
    export map — so this is a fixed 1:1 aspect passed into the existing
    crop-and-zoom flow in the admin, not new geometry.
  - **A separate `store_banner_url` for the cover.** A wide image spanning the
    full app width above the header, in the shape people already understand from
    a social profile cover (roughly 3:1). New public setting alongside
    `STORE_LOGO_KEY` in `packages/api-client/src/settings-keys.ts`, a second
    upload slot in `StoreBranding.tsx`, and a new `ui/` primitive rather than
    markup inside `GamePicker` — it will want to appear on the result screen
    too, which is the "only the landing screen knows the store's identity"
    problem above arriving for the third time.
  - **Two constraints worth deciding before building.** The banner sits at the
    very top, so it either replaces or sits above the `from-brand-4 to-brand-3`
    gradient that every screen shares — decide which, because "both" is how a
    header ends up with two backgrounds fighting. And an unset banner must
    render as *nothing*, not as a grey placeholder box: an unconfigured
    storefront should look clean, the same rule the missing logo already follows.
- **One number input for the whole admin, with real controls on it.** Every
  numeric field in the admin is a bare `<Input type="number">` — the settings
  rows (`SettingsPanel.tsx`), the per-game benchmarks (`GameBenchmarks.tsx`),
  and the award form's `minScore` / `stock` / `sortOrder` (`AwardForm.tsx`).
  They inherit the browser's native spinner, which is roughly a 10px target
  stacked two-high: it fails the project's own 44px tap-target rule outright, and
  on a phone it is not there at all. A `NumberInput` in
  `apps/admin/src/ui/Controls.tsx` with **optional `+` / `−` buttons** is the
  fix, and it is the natural home for several other things currently missing:
  - **Steppers only where a step means something.** `+`/`−` is right for
    `sortOrder` and `stock`; it is silly for a value of 168, which is why the
    `step` should come from the caller and the buttons should be opt-in rather
    than automatic. Press-and-hold to repeat is what makes a stepper usable
    beyond about five presses — worth building once, here, rather than never.
  - **Clamping belongs in `admin-core`, not in an onChange.** `min`/`max`/`step`
    rounding is a pure function and should sit beside `duration.ts` so it is
    tested. `DurationInput` should then be rebuilt on top of `NumberInput`
    instead of hand-rolling `Math.max(0, Math.floor(...))` as it does today.
  - **`Award.stock` has a sentinel and a stepper must respect it.** `-1` means
    unlimited (`UNLIMITED_STOCK` in `packages/api-client`), so decrementing from
    0 must stop rather than walk into it, and the field wants an explicit
    "unlimited" affordance rather than expecting an operator to type minus one.
  - **A cleared field is not zero.** Today `Number(e.target.value) || 0` turns a
    half-typed value into `0` mid-keystroke, so backspacing to retype silently
    proposes a real change. The component should hold the empty string as a
    distinct state and only coerce on blur.
  - **Two small correctness fixes it can carry for free:** a `wheel` handler
    that blurs instead of scrolling the value — a focused number input silently
    changing while the page scrolls is a genuine data-loss bug — and
    `inputMode="numeric"` everywhere so a phone offers a number pad
    (`DurationInput` sets it; nothing else does).
  - **A suffix slot** for the unit, so "taps/second" and "ms" sit inside the
    field rather than only in the prose description above it.
  - It bites on every admin visit from a phone, which is the device an operator
    at a counter actually has.

### What the bilingual player app does not cover

The player runs in Thai end to end; these are the gaps it left, ordered by how
soon each bites. The rules for *where* a string lives are in the repo-root
`CLAUDE.md`, not here.

- **A half-translated prize list shows the same prize twice.** The landing
  showcase merges prizes by NAME across games (`mergePrizes`,
  `packages/player-core/src/prizes/merge.ts`), and the seeded catalog gives all
  three games a prize called "Free Coffee" — one row, not three. Translate
  tap-fast's copy alone and that row splits: "กาแฟฟรี" from tap-fast, "Free
  Coffee" still from the other two, both on screen, both the same coffee. It is
  merge-by-name meeting per-award translation — renaming one game's copy in
  English has always split the row the same way, but translating half a prize
  list is a routine thing to do. The honest fixes, cheapest first: merge on a
  stable key rather than the display name (awards have ids, but the showcase
  deliberately does not carry them — see `PublicAward`); or warn in the admin
  when two awards share an English name and disagree on the Thai one. It bites a
  venue mid-translation, which is every venue that adopts this, once.
- **Score rejections keep an English diagnostic.** `writeAppError` in
  `internal/httpapi/respond.go` serves `err.Error()` for `ErrScoreRejected` in
  English and a plain sentence in Thai, because the validator messages in
  `internal/game/catalog.go` are *composed* ("score 900 exceeds plausible
  maximum 120 for 5000ms") rather than looked up. Translating them properly
  means typed rejection reasons — a small enum plus formatting args — not a
  bigger message table. Rare on a real device (it takes a fabricated score).
- **The admin app is untranslated**, deliberately: it is operator-facing, and one
  bilingual audience was the scope. `packages/admin-core` has no dictionary, so
  this is the same job again against a smaller surface. It bites when the venue's
  own staff, rather than its customers, are the Thai speakers.
- **A store has one name, not one per language.** `store_name` and
  `store_tagline` are single settings, so an operator who wants an English and a
  Thai wordmark has nowhere to put the second. This is the last untranslated
  player-facing string, and the pattern is already settled by the award fields:
  `store_name_th` / `store_tagline_th` added to the allowlist in
  `internal/settings`, two more inputs on `StoreBranding.tsx`, and the per-field
  pick in `storeIdentity` (`player-core/brand.ts`) — which is the one place it
  CANNOT reuse `reward.Text`, because that lives in Go and this fallback happens
  client-side, the settings endpoint serving a flat map rather than resolved
  prose. Worth noting the asymmetry deliberately: awards resolve server-side and
  the store's identity would not.
- **Nothing tests Thai at 320px.** Thai has no spaces between words, so
  `truncate` cuts mid-word instead of shortening; the dictionary keeps every
  string that lands in a fixed slot short *on purpose* (see the header comment in
  `th.ts`), but that is a convention, not a check. A Playwright pass at 320px
  asserting no horizontal overflow would make it one — the suite runs at Pixel 7
  width (412px) for every spec, so this wants a narrower
  `test.use({ viewport })` block rather than a new project. Cheap, and it is the
  check that would catch the Thai store name an operator types into
  `StoreBranding`: admin free text is translated nowhere, so the longest string
  on the landing header is the one nobody reviewed.

### The rest of the admin

- **An admin panel for editing every string, filtered and searchable.** The
  player's strings live in two dictionaries
  (`packages/player-core/src/i18n/{en,th}.ts`), which is most of the organising
  this needs — but they are *compiled in*, so fixing a typo is a deploy. The
  remaining job is a migration from module to database, and only then a panel
  over it.
  - **Model it on `AwardsPanel`, because the shape is already solved.** That
    panel has a filter (`?game=`, `?status=`), a search (`?q=`) and a sort
    (`?sort=`), all parsed by pure functions in
    `packages/admin-core/src/awards/filter.ts` and all addressable — see the
    route grammar in `admin-core/src/router/routes.ts`. A strings panel wants
    exactly that: filter by **page/screen**, search across key and value, and
    both reflected in the URL so a colleague can be sent a link to the one
    string under discussion.
  - **Page filter needs the strings to know where they appear**, which is a
    property nobody has to record while the strings are literals. Whatever holds
    them (a `strings` table, or settings rows under a prefix) needs a `screen` or
    `namespace` column from the first migration — retrofitting it means
    re-classifying every row by hand.
  - **It needs a new tab**, and `TABS` in `admin-core/src/router/routes.ts` is
    the single place that decides both the tab strip and the set of paths the
    router accepts, so adding one is a single-line change plus a panel.
  - Note this collides with **Real auth** above in a way award edits do not: a
    shared secret that lets anyone reword every player-facing message is a
    bigger blast radius than one that lets them change a prize threshold.
- **Config change history** and one-click rollback for settings/awards.
- **A/B testing** thresholds and reward mixes to optimise retention.

## Player experience

- **Share score photo** — a "Share" button on the result screen that generates an
  image of the player's score, decorated with the store theme and name. Read the
  name from `storeIdentity` (`packages/player-core/src/brand.ts`) rather than the
  fallback `defaultIdentity(t)` returns, or every shared card will say "Fun
  Store" whatever the shop is called — and, since that fallback is translated,
  will say something different depending on the language it was shared in. The
  result screen does not fetch settings today (see "Only the landing screen knows
  the store's identity" above), so this needs the identity lifted or refetched
  there. Render the card to a `<canvas>` from the same palette tokens, then hand
  the blob to the Web Share API (`navigator.share({ files })`) with a download
  fallback on desktop. The screen already has everything the card needs — score,
  unit, rank, prize, player name — and the URL is permanent, so the image can
  carry a QR/short link back to it. See "Link previews for shared results" below
  for the preview that pairs with this.
- **Image editor before sharing** — let the player decorate the generated card
  before saving: stickers/icons, a caption, maybe a frame or filter. Keep the
  editor's state as plain data (a list of placed items with position/scale/
  rotation) and the render as a pure `draw(state) → canvas` function, so the same
  description can be re-rendered at export resolution without a second code path.
  Worth scoping the sticker set to store branding to keep moderation trivial.
- **Sound and haptics** for the reveal — the animation beats are already there to
  hang them on (`navigator.vibrate` on the puck landing, a bell on a record).
- **Accessibility** — larger tap targets and screen-reader labels. Reduced
  motion, focus rings, the announced score (`ScoreReveal`) and announced errors
  (`StatusMessage`'s `tone`) are done. The largest remaining target problem is
  the admin's native number spinners — see the `NumberInput` entry above.
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
  picker after N seconds so the next customer starts clean. Pairs with the
  landing screen's refresh control, which already reloads the catalog and the
  settings together (`App.reload`): a timer returning to the picker should
  refetch on the way.

## Platform / infrastructure

- **DynamoDB adapter** implementing `storage.Store` (the interface is ready) and
  a Postgres adapter for richer querying/analytics.
- **Caching** for the hot read paths (game catalog, leaderboards, and the public
  prize showcase) with invalidation on write. Two shapes, and they want different
  answers:
  - The landing screen fetches prizes **once per game** (`state/usePrizes.ts`),
    all identical for everyone — re-derive the count from the registry rather
    than trusting a number written here. The cost grows with the catalog, so
    every new game makes the landing page slower for everyone. The obvious first
    thing to batch or cache.
  - `state/usePublicSettings.ts` fetches `GET /api/v1/settings/public` on mount
    and again on every refresh-button press. It does *not* grow with the catalog
    — one request whose response is the same handful of bytes for every player in
    the venue, changing perhaps twice a year. That makes it the cheapest possible
    thing to serve from an `ETag` or a short `Cache-Control: max-age`, and the
    one where the refresh button gives the argument its edge case: a cache the
    operator cannot bust from the player's own reload control would make the
    button lie.
- **Observability** — structured logging, request tracing, metrics (play latency,
  error rates), health/readiness probes.
- **Containerization + IaC** for reproducible deploys; single-binary embed mode
  (serve both frontends from the Go binary on one port).
- **Feature flags** to roll games/campaigns out gradually.

## Follow-ups from shipped work

Concrete, near-term items, roughly ordered by how soon they will bite.

### Result URL polish

- **The benchmark/top-prize convention breaks silently on a live edit.** Every
  game's `TargetScore` equals the `MinScore` of its hardest starter award, so
  "filled the tower" and "won the best prize" are the same event to a player;
  `TestBenchmarkMatchesHardestStarterAward` (`internal/app/seed_test.go`) holds
  that for the *seeded* ladder. Nothing holds it afterwards: an admin editing an
  award's threshold, or retuning a benchmark from `GameBenchmarks.tsx`, breaks
  the pairing with no signal. Both are live edits, so catching them needs a check
  at write time or a warning in the admin when the two disagree — not another
  unit test.
- **Precision Stop's score cannot be verified server-side, and its validator
  says so.** `validatePrecisionStop` bounds-checks (`0 <= value <=
  PrecisionTrackHalf`) and stops there, because the marker's starting phase is
  drawn on the client (`PrecisionStop.tsx`, `phaseRef`), leaving the server no
  shared secret to recompute a stop position from. Tap Fast has a physiological
  ceiling and Reaction Timer a physiological floor; this game has neither, so a
  fabricated `0` is indistinguishable from a perfect round. It is the first game
  where **"server-authoritative scoring"** in the anti-abuse section buys
  something concrete: sending the phase seed with the session and the stop
  timestamp with the score would make it checkable.
- **`reactionVerdict` is dead code that breaks the no-prose rule.** It grades a
  reaction (`player-core/src/games/reaction.ts`) and nothing renders it — the
  reveal's tier ladder took over grading a round. Its twin `precisionVerdict`
  escaped that fate by getting a surface (the post-stop hold's readout) and now
  returns a `MessageKey`; this one still returns English words — `"Lightning"`,
  `"Sharp"`, `"Solid"` — which is exactly what `frontend/CLAUDE.md` forbids a
  package to hold, and its unit test asserts those strings. It was missed because
  it is dead: nothing rendered it, so nothing showed up untranslated. Deleting it
  is the cheaper of the two options unless a per-game verdict moment is actually
  wanted — and note the "no prose in packages" rule is currently enforced by
  convention rather than by anything that runs.
- **Link previews for shared results.** Result URLs are permanent and worth
  sharing, but the SPA serves the same empty `index.html` to every crawler, so a
  pasted link shows nothing. Needs a small server-rendered route emitting OG/
  Twitter meta tags (title = "Po scored 37 taps at Fun Store", image = the
  generated score card). This is the piece that makes the share feature above
  actually spread.
- **Rate-limit the public reads.** `GET /games/{slug}/scores/{id}` and
  `GET /games/{slug}/awards` are both unauthenticated, and the awards one is hit
  on every landing-page load. Score ids are nanoid(11) — 66 bits, down from
  UUIDv4's 122 — so guessing one is still impractical, but the margin that made
  "enumeration is impossible" a throwaway line is smaller, and a per-IP limit
  belongs here before real prizes are on the line.
  **Claim codes changed what a score id is worth.** `ScoreResult` returns the
  claim, and `GET /games/{slug}/scores/{id}` is unauthenticated — the full code
  comes back with no admin token. That is not a bug to patch, it is the design: a
  player has no account, so the unguessable result URL is the only way to show
  them their own code. But it makes the score id a **bearer capability for a
  prize** rather than a name for a public leaderboard row, and nothing in the app
  treats it that way. The consequences are all in where URLs leak rather than in
  guessing: shared links, browser history on a borrowed phone, screenshots, a
  `Referer` header to any third party the result page ever loads. Worth deciding
  deliberately before prizes have value — the options are rate-limiting (cheap,
  partial), omitting the code unless the request proves it owns the round
  (correct, needs a token minted at submit time), or accepting it explicitly and
  writing down that a result URL is as sensitive as the prize.
- **A deleted award still rewrites a LOSING round's history.** `claims.award_name`
  is a snapshot, so a round that won something keeps saying what it won even
  after the prize is deleted. A losing round has nothing to snapshot, and
  `Service.awardByID` still degrades a deleted award to "no prize" — as it does
  for any win issued before claims existed. Soft-delete/archive is the complete
  answer, and it pairs with the audit-trail item below.
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

Nothing here is wrong today — these are the seams that give way as the catalog
and the score table grow.

- **Award filtering is entirely client-side.** `AwardsPanel` fetches the whole
  unpaginated table via `listAwards()` and narrows it in `filterAwards`. Correct
  at a few dozen prizes, and it keeps the filter logic pure and unit-tested; but
  the URL already carries exactly the parameters a server-side query would need
  (`?game=&status=&stock=&q=&sort=`), so moving the work behind the API later is
  a swap of the data source, not a redesign of the panel.
- **The scores panel has no filters and a hard-coded `limit=25`.** `?game=` is
  the only parameter it honours — no date range, no pagination, and no way to
  find one player's rounds. Fine for a leaderboard and useless for the question
  an admin actually arrives with: "this customer says they won a coffee on
  Tuesday." `GET /api/v1/admin/claims` answers the counter's version of that by
  code; the scores panel still cannot answer it by person or by date.
- **Changing the claim TTL does not move existing claims.** `app.issueClaim`
  reads `claim_ttl_hours` once and stamps the result into `claims.expires_at`
  (the `claim.TTL(...)` call in `service.go`), so the setting only governs claims
  issued afterwards. That is the right storage model — a claim's deadline should
  not move under the person holding it — but `SettingsPanel` renders every
  setting the same generic way, so an admin shortening the window sees a knob
  that looks retroactive and is not. The fix is copy on that setting, not a
  change to the data.
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
  Note what an un-redeem must not break: `admin-claims.spec.ts` › "refuses the
  same code a second time" asserts single-use, and it would rightly fail the day
  someone wires an un-redeem into the same path.
- **`redeemed_at` records when, never who.** The claims table has no actor
  column (`003_claims.sql`), and the admin API is one shared secret with no
  identities behind it, so "who handed this prize over?" is unanswerable by
  construction. Same root cause as the award-delete audit gap below, and the
  same fix buys both: admin identities, then an audit log.
- **The awards panel is half-covered: EDIT is exercised, CREATE and DELETE are
  not.** `admin-awards-i18n.spec.ts` drives the filter, opens one prize's form,
  saves it, and checks the result reaches the player — but it got there by
  editing a *seeded* award. Nothing has ever run `+ New award` or the delete
  confirmation (`AwardsPanel.tsx`, `AwardForm.tsx`). Two reasons that gap is
  worth closing rather than declaring covered:
  - **Delete confirms and then destroys, with no audit trail** (see the last
    entry in this section). A flow whose only safeguard is a confirm dialog is
    worth exercising before that safeguard is the thing that regresses.
  - **Create is where validation lives.** `validateAward` rejects an empty name
    and an out-of-range stock, and the form's `-1`-means-unlimited checkbox is
    the only UI for a sentinel — none of which an edit of a valid seeded row
    ever touches.
  The hazard a create/delete spec faces: the suite shares one backend, so an
  award a test leaves behind changes what every later round can win. A create
  test must delete its own prize on the way out and assert the delete landed.
- **Every award row's Edit and Delete buttons share one accessible name.**
  `AwardsPanel.tsx` renders "Edit" and "Delete" per row with nothing
  distinguishing them, so a screen reader hears a column of identical controls —
  the same defect `ClaimRow` fixed with `aria-label={`Redeem claim ${code}`}`.
  It is also why `admin-awards-i18n.spec.ts` has to narrow the list to a single
  row with `?game=&q=` before it can click one: the locator ambiguity is the
  accessibility bug, visible from the outside. One `aria-label` each, following
  the pattern already in `ClaimRow`.
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

- **Visual regression.** Every layout bug this repo has written down was purely
  visual — collapsed tier labels, a bell overlapping text, halo rings crossing a
  caption, a number field collapsed to a sliver with Save landing on top of a
  dropdown — and none of them is catchable by a DOM assertion. Playwright's
  `toHaveScreenshot()` would, but it needs a pinned container image for stable
  font/emoji rendering; deliberately deferred rather than half-done. Note the
  admin has the worse record of the two apps and is now reachable to the suite,
  which changes what a baseline would be worth without changing what it costs.
- **The end-of-round duration is written down twice.** `COMPLETE_BEAT_MS` and
  `REVEAL_DURATION_MS` live in `packages/player-core/src/reveal/pacing.ts`, and
  `END_OF_ROUND_MS` in `e2e/helpers/round.ts` restates their sum as a literal —
  the e2e package sits outside the frontend workspace on purpose, so it cannot
  import them. The floor has 800ms of slack, so drift degrades the assertion
  quietly rather than failing it. A generated constants file, or reading the
  values off the page, would close it.
- **Every E2E round costs a fixed, unskippable ending.** Do not trust a number
  written here — **re-derive it**: `grep -c 'playRound(' e2e/tests/*.spec.ts`,
  plus the Precision Stop test, which reaches the same sequence by a different
  route (it ends the round on a tap instead of waiting out a clock). That
  instruction has paid for itself repeatedly: the count has been wrong at every
  reading, because rounds are no longer played only by specs that are *about*
  playing — every cross-app claim test wins its code by playing rather than
  fabricating it, which is the point when the thing under test is the wire
  between the apps. The cost grows with every game AND with every cross-app
  test. Still acceptable; if it stops being, the reveal needs a test-only way to
  shorten the beats that is not the skip that was deliberately removed.
  Emulating `prefers-reduced-motion` already collapses both holds to zero
  (`holdMs`) and is the obvious lever.
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
  only ever compiled. It skipped on every push of the session that built the
  claim lifecycle — four ships, zero native runs — which is the shape the
  problem actually takes: not one forgotten check, a standing one.

### Small cleanups

- **Duplicate session on mount in dev.** React StrictMode double-invokes effects,
  so `RoundRunner` requests two sessions per round locally (visible in the API
  log). Harmless — the second token wins and sessions expire — but it makes dev
  logs misleading and would matter if session creation ever costs something.
