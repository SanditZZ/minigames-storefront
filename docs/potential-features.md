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
- **Name an icon from `packages/icons`.** `MiniGame.icon` is typed `IconName`,
  so a game either picks a mark that exists in the table or does not compile.
  Adding a Phosphor fill icon to the table first is part of adding the game.

A third thing a new game **may** do, and the reason to weigh it before writing
one: **declare a `Scorer` instead of a `Validator`** and let the server compute
the score from the player's events. Stack is the worked example
(`internal/game/stack.go`). It costs a mirrored simulation and a golden fixture;
it buys a score nobody can assert. Only games whose rules replay from their
inputs can take that path — see the entry under "Anti-abuse / integrity".

**Every game's ladder seeds a prize called "Free Coffee"**, and the landing
showcase merges prizes by name (`mergePrizes`), so all of them collapse into one
row. That makes `GAMES` in `e2e/tests/admin-awards-i18n.spec.ts` a list that has
to grow with the catalog — a game missing from it leaves an untranslated row on
a Thai storefront and fails that spec. Adding Stack is what caught it.

Games worth building, ordered by what they add to the catalog rather than by
how fun they are — the three shipped reflex games plus Stack's timing already
cover the twitch axis, so the gap is **cognitive**: a customer who is not quick
with their hands currently cannot win a prize at all.

- **Odd One Out** — a grid of tiles, one a subtly different shade; each level
  subtler. Score = levels cleared in N seconds. Cognitive, needs no prose inside
  the game (so its whole i18n cost is the name and unit in `internal/game/i18n.go`),
  and it renders in the store's own palette — the tiles ARE the branding.
  Server-scorable: the server picks the tiles.
- **Quick Math** — N problems in a fixed window, **four answer buttons rather
  than a keypad**; typing digits on a stranger's phone is slow and is what would
  make this feel like a test. Server-scorable: the server sets the problems.
- **Memory Flash** — repeat a flashed sequence; score = longest sequence. Note
  its scoring fights the fixed clock every other game uses: "longest sequence"
  has no ceiling, so a strong player runs long and the queue waits. Capping the
  levels is the fix, and it is worth deciding before building rather than after.
- **Swipe/Whack** — tap targets that pop up; score = hits. Cheapest to build and
  the best game to WATCH someone play, but it needs a rule against mashing (some
  targets must not be tapped) or it is Tap Fast on a grid.
- **Hold Steady** — keep a dot inside a shrinking ring; score = ms survived.
  Listed last deliberately: it is a second continuous game the server cannot
  replay, so it deepens the gap Precision Stop already leaves, and fine motor
  control on a small screen is the least accessible input in the catalog.

## Reward system depth

- **Probability / rarity** — award a prize with a configured chance, not just a
  hard threshold (e.g. "reach 40 → 20% chance of Coffee").
- **Daily / per-customer win caps** — limit prizes per person per day to control
  cost (needs customer identity, below).
- **Time-boxed campaigns** — awards with start/end windows and schedules.
- **The web scanner exists and cannot run anywhere this project is served.**
  `useCodeScanner` (`apps/admin/src/scan/`) opens the rear camera and decodes with
  `BarcodeDetector`; `scanAvailability` (`admin-core/src/claims/scan.ts`) decides
  whether to offer the control and, when not, which of three reasons to show. On
  every origin this repo actually uses, at least one reason applies:
  - **Plain HTTP has no camera API at all.** `scripts/serve-prod.sh` serves the
    Tailscale IP over HTTP, so `navigator.mediaDevices` is `undefined` — the same
    rule that removes `navigator.clipboard` there, documented at length in
    `apps/player/src/clipboard/copy.ts`. The fix is real HTTPS on the tailnet
    (`tailscale cert` / `tailscale serve` issue a genuine cert for the `*.ts.net`
    name), which would also let the clipboard's modern path start winning by
    itself. Chrome's `--unsafely-treat-insecure-origin-as-secure` is a per-device
    dev switch, not a deployment.
  - **`BarcodeDetector` is not implemented on Linux Chromium**, so even
    `localhost` — which *is* a secure context — cannot decode. This was measured,
    not assumed: `BarcodeDetector` is absent from the Playwright browser this
    repo's suite runs in. Portable decoding means shipping a wasm/JS decoder into
    an app whose only runtime dependency is React, which is a dependency decision
    rather than a fix.
  - Consequently **the web scan path has no browser coverage** — the pure ranking
    is unit-tested (`scan.test.ts`) and the camera code is exercised nowhere. If
    HTTPS lands, Playwright can feed a fake camera
    (`--use-fake-device-for-media-stream --use-file-for-fake-video-capture`) with
    a pre-rendered QR video, and `tests/admin-claims.spec.ts` is where it goes.
  - **The native admin is the honest home for scanning**: `expo-camera` asks the
    OS and is bound by none of the above.
- **A QR could carry more than a bare code, and that is a security decision.**
  `ClaimCard` encodes the raw claim code, which keeps the blast radius where it
  is. A deep link into the admin (`/claims?code=…`) would be faster for staff and
  would turn a prize credential into a URL, which spreads the way the "score id is
  a bearer capability" entry below describes. Prefer the bare code until claims
  have owners — and note `@minigames/qr-core` would need extending first: it
  encodes version 1 only (ten alphanumeric characters), and its header comment
  names the three extension points a longer payload needs.
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

- **Server-authoritative scoring: two games still self-report.** `game.Definition`
  carries an optional `Scorer` beside its `Validator`, and `app.scoreOf` is the
  one place they diverge — a game with a Scorer has its `value` ignored entirely
  and its score replayed from the events it reported, against the challenge stored
  on its session. Stack and Precision Stop are both written that way. **Tap Fast
  and Reaction Timer are not, and they are harder than the two that landed**: a
  Scorer replays a TIMELINE, and neither of these reports one. A tap count is a
  total, not a sequence of moments, so migrating Tap Fast means the client sending
  every tap — a payload bounded only by how fast a thumb moves — and Reaction
  Timer's score *is* its elapsed time, so there is nothing to replay that is not
  already the number. Both at least have a physiological bound to appeal to
  (`validateTapFast`'s ceiling, `validateReactionTimer`'s floor), which is why
  they were left until after the game that had neither.
  - **It stops fabrication, not automation.** A script that simulates the same
    physics can still emit perfect events — for Precision Stop, computing the ms
    at which the marker crosses centre is a few lines. The bar moves from "POST a
    number" to "write a player", which is the ceiling for anything client-rendered
    without device attestation. `ScoreStack` and `ScorePrecisionStop` both say so;
    any new Scorer's comment should too rather than implying more.
- **The golden-fixture generators are per-game, and there are now two of them.**
  `stack_golden_test.go` and `precision_golden_test.go` share a flag
  (`-update`) and an arrangement — Go generates, vitest reads — but not a line of
  code: each hand-rolls its own case matrix, JSON shape and staleness message. A
  third Scorer game makes that a pattern worth extracting rather than copying a
  second time. Note what must NOT be generalised away: the case matrices are
  game-specific on purpose, because the values worth pinning are the ones where
  that game's particular truncating division could disagree across languages.
- **`Scorer` takes `[]int` plus raw challenge bytes.** The timeline fits Stack's
  drops and Precision Stop's single stop. A game whose events need a TARGET as
  well as a time — a whack-a-mole tap naming which hole — is the point at which
  the event type becomes per-game. The challenge is `[]byte` for the same reason
  the client receives `unknown`: its shape belongs to the individual game and the
  signature must not know which game it is describing. Deliberately not
  generalised in anticipation; the note is here so the next person knows both
  were decisions.
- **Nothing rate-limits a submission carrying events.** `SubmitInput.Events` is
  the only variable-sized player payload. Stack bounds it per round
  (`StackMaxDrops`) and Precision Stop accepts exactly one event, so the exposure
  is small, but it belongs with the rate-limiting entry below rather than nowhere.
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
- **Nothing ever reclaims an orphaned upload.** Replacing an award's image, the
  store logo or its cover banner overwrites the URL and leaves the previous file
  on disk forever;
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
  bug class the geometry was extracted to prevent. It is worth more than it was,
  because the aspect ratio is no longer effectively constant: the three callers
  of `ImageField` ask for 4:3, 1:1 and 3:1. `frameFor` is unit-tested against
  all three — the CANVAS is what still is not, and a 3:1 preview leaves the most
  room for a draw call to disagree with the export.
- **The contrast warning is advisory, and nothing measures the store that
  ignores it.** `lowContrastPairs` (`packages/tokens/src/contrast.ts`) flags an
  illegible palette in `StoreBranding.tsx` beside a Save that stays enabled — on
  purpose, since a venue's brand colour is not negotiable with a validator. The
  consequence is that a store CAN be running an unreadable palette and nothing
  downstream knows: the player app never re-checks what it was handed, and no
  admin view lists "stores currently below AA". Only worth building when there
  is more than one store.
- **A browser that has never seen this storefront still pays for the settings
  round trip.** The remembered copy (`apps/player/src/state/settingsCache.ts`)
  fixes every visit after the first and cannot fix the first: with nothing in
  storage, the player still paints the built-in palette and the fallback
  wordmark, and the landing screen still grows a 3:1 banner that shoves the game
  list down when the settings land. Closing that needs the answer to be IN the
  document rather than behind a request — `serve-prod.sh` baking the current
  settings into each app's `index.html` at deploy time, or a server-rendered
  route — and both reintroduce the deploy-time/read-time drift the runtime
  override was chosen to avoid. It bites a given device exactly once, which is
  why the half that could be fixed without that trade was, and this half is
  filed. Note the result screen is the worst case even now: a result URL opened
  cold by someone who has never visited the storefront is precisely the visit
  with nothing to remember.
- **The admin repaints its own palette after the gate.**
  `apps/admin/src/theme/useBrandPalette.ts` is still a passive effect fed by the
  authed settings list (`App.tsx`), so an operator picking colours sees the
  built-in palette until sign-in resolves. The player's fix does not transfer
  wholesale — that copy is of the PUBLIC settings, and the admin's payload is
  every setting there is — but the colour keys ARE public, so remembering only
  those is the version worth building. Lower stakes than the player's: one
  operator, on a device they use daily.
- **A logo uploaded before the square crop is cropped, and nothing says so.**
  `StoreMark` now renders the mark in a fixed 1:1 box (`object-cover`) and the
  admin's logo field exports 400×400, but a `store_logo_url` set when the field
  exported 600×200 is still that wide file — so it renders as its own centre
  third, with the ends of a wordmark cut off. There is no migration to write:
  the stored value is a URL to an image whose pixels are wrong for the new box,
  and only the operator can reframe it. The honest fixes are a note on the field
  when the saved image is not square (needs the admin to load the image and read
  `naturalWidth`, which is a browser thing rather than a calculation), or
  accepting it — the wrongness is visible on the landing screen the first time
  they look. It bites exactly once per store that had a logo before this
  shipped, which today is however many of them uploaded a wide one.
- **`NumberInput`'s wheel handler is still untested.** The stepper's repeat and
  the cleared-field draft are covered now (`admin-forms.spec.ts`), but the
  `onWheel` that BLURS the field is not: it exists so a focused number input
  cannot absorb a page scroll, and asserting it needs a wheel event over a
  focused input plus a check that the page scrolled and the value did not.
  Cheap to add to the same spec; left out because a wheel is not an input a
  phone has, and this admin is used on one as often as not.
- **The `NumberInput` suffix gutter is fixed, so a long unit clips.** The
  reserved room and the span's `max-w` are two constants in
  `apps/admin/src/ui/Controls.tsx` that have to agree, and the units come from
  the server already translated (`internal/game/i18n.go`) — so the widest suffix
  they were sized against is not the widest one a Thai storefront renders. It no
  longer overlaps the digits, which was the unrecoverable failure; it truncates
  instead, which is merely bad. The honest fix is measuring the rendered suffix
  and padding to it, which needs a layout effect and is the only version that
  cannot be out-grown.

### What the bilingual player app does not cover

The player runs in Thai end to end; these are the gaps it left, ordered by how
soon each bites. The rules for *where* a string lives are in the repo-root
`CLAUDE.md`, not here.

- **A half-translated prize list shows the same prize twice.** The landing
  showcase merges prizes by NAME across games (`mergePrizes`,
  `packages/player-core/src/prizes/merge.ts`), and the seeded catalog gives EVERY
  game a prize called "Free Coffee" — one row, however many games there are.
  Translate tap-fast's copy alone and that row splits: "กาแฟฟรี" from tap-fast,
  "Free Coffee" still from the rest, both on screen, both the same coffee. It is
  merge-by-name meeting per-award translation — renaming one game's copy in
  English has always split the row the same way, but translating half a prize
  list is a routine thing to do. **This is no longer hypothetical**: adding Stack
  gave the catalog a fourth "Free Coffee" and broke
  `admin-awards-i18n.spec.ts`, which translates a hard-coded list of games and
  had not been told about the new one. The seeded ladder gives EVERY game a
  prize by that name, so re-derive the count from `app.starterAwards` rather
  than trusting a number here. The honest fixes, cheapest first: merge on a
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
- **The 320px check covers two screens, and the app has more than two.** The
  narrow-viewport block in `language.spec.ts` measures the landing screen and a
  round in progress; the RESULT screen — the one carrying a claim code, a prize
  name and a leaderboard, i.e. the most crowded row in the app — is not measured,
  because reaching it costs a full round's unskippable ending. The same is true
  of the admin, which nothing checks at any width. Extend `horizontalOverflow`
  (`e2e/helpers/layout.ts`) to those rather than writing a second measurement.

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
  identity is already on the result screen (`useStoreIdentity`), so this is a
  read rather than a fetch. Render the card to a `<canvas>` from the same palette tokens, then hand
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
- **The icon table is transcribed by hand and nothing checks it against Phosphor.**
  `packages/icons/src/data.ts` was copied out of `@phosphor-icons/core` v2.1.1;
  `data.test.ts` catches an empty entry, a `d` that lost its head, and two names
  drawing the same shape, but none of those notice a path transcribed *slightly*
  wrong or an upstream redraw. The shape of the fix is already in the repo —
  `npm run theme:check` fails when a generated file drifts from its source — but
  an `icons:check` differs in one way that decides whether it is worth it: the
  source is a remote package, so the check needs the network and would fail on a
  plane rather than on a mistake. A vendored copy of the upstream SVGs, diffed
  offline, is the version that could join the gate. It bites when someone adds an
  icon in a hurry, which is every icon after the first batch.
- **The player's icons have no size or colour system, only per-call classes.**
  Every emoji carried its own colour; an `Icon` fills with `currentColor`, so
  each call site now picks one — `text-ink/30` on `StatusMessage`, `text-ink/40`
  on `PrizeImage` and `HighlightCard`, full `ink` on the completion flag and the
  reveal's bell. Those values were chosen one at a time while converting, not
  designed together, and nothing stops the next from being `text-ink/35`. Fill
  raised the stakes slightly over the stroke set this replaced: a solid mark at
  40% reads as a heavier block than an outline at 40% did, so the opacities were
  inherited rather than re-judged. If a third app-level slot wants an icon,
  promote the choices to a `tone` prop on `Icon` rather than adding another
  literal.
- **`mobile/admin` has no icons at all, and its `Icon.tsx` is unwritten.** The
  native admin renders none today, which is why the sweep did not touch it. The
  table is deliberately ready for it — `d` strings rather than markup, so every
  row is one `react-native-svg` `<Path>` — but the renderer still has to be
  written the first time a native screen wants a mark. Write it from
  `apps/*/src/ui/Icon.tsx`; the only real differences are `<Svg>` for `<svg>` and
  `size` in points instead of `1em`, since RN has no font-relative units.
- **Sound and haptics** for the reveal — the animation beats are already there to
  hang them on (`navigator.vibrate` on the puck landing, a bell on a record).
- **Accessibility** — larger tap targets and screen-reader labels. Reduced
  motion, focus rings, the announced score (`ScoreReveal`), announced errors
  (`StatusMessage`'s `tone`) and the admin's number fields (`NumberInput`, which
  replaced the native spinners) are done. What is left is a sweep rather than a
  known offender: nothing has audited either app against the 44px rule, so the
  next failure will be found by measuring, not by remembering.
- **A pinned leaderboard row has no browser coverage.** `boardRows`
  (`player-core/src/board/rows.ts`) is unit-tested, but no spec has ever seen the
  pinned row on screen: every E2E round lands on a nearly empty board and is
  therefore inside the top ten, which is exactly the case `boardRows` returns
  unchanged. Reaching the interesting case needs eleven scores in one game, so
  the honest version seeds them through the API rather than by playing.
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
- **Caching for the remaining hot reads: the game catalog and the leaderboards.**
  The two the landing screen pays for are settled — the prize showcase is one
  batched query (`GET /api/v1/awards`) and the public settings read is a
  conditional GET (`writeJSONRevalidated` in `internal/httpapi/respond.go`) — and
  the same conditional-GET treatment is the obvious next step for both of these.
  `GET /api/v1/games` is the strongest candidate: identical for every player,
  changing only when an admin enables a game, and on the render path of the first
  screen. A leaderboard is the weaker one, since it changes on every round played
  in the venue, and a tag recomputed per request buys nothing when the body
  changes that often — it wants a real invalidation-on-write cache or nothing.
- **The batched prize read is not conditional, and it is the biggest public body
  we serve.** `handleAllPrizes` returns every game's ladder on every landing-page
  load; `writeJSONRevalidated` would cost one line there. It was left out
  deliberately rather than forgotten: a prize's `soldOut` flips as stock runs
  down mid-shift, so the tag would miss more often than the settings one does,
  and the saving is worth measuring before it is claimed. Measure the hit rate on
  a real venue's traffic first.
- **The showcase still waits for the game list before it starts.**
  `state/usePrizes.ts` gates its fetch on `games` even though the batched read no
  longer needs the slug list — that parameter is now only a re-fetch trigger. So
  two independent requests run in series on the first screen: `/games` resolves,
  then the prize strip begins. Separating "when to fetch first" from "when to
  re-read" would let them go together; the reason it was not done with the
  batching is that fetching on mount AND on a catalog change double-fires on the
  first load, and getting that wrong is a worse landing screen than a slightly
  later prize strip. Worth doing when first paint is actually measured.
- **The per-game prize route has no caller.** `GET /api/v1/games/{slug}/awards`
  (`handlePrizes`) was the landing screen's read and is now nothing's — the
  showcase uses the batch, and no app asks one game for its own ladder. It is
  kept because it answers a real question and the client method mirrors it, but
  an endpoint nothing calls is an endpoint nothing notices breaking. Either give
  it a caller (a per-game "what can I win here?" panel is the natural one) or
  delete it and its `gamePrizes` client method together.
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
- **Nothing enforces "a package may not hold prose."** `frontend/CLAUDE.md`
  forbids it and the rule is kept by convention alone. `reactionVerdict` sat in
  `player-core/src/games/reaction.ts` returning `"Lightning"` and `"Sharp"` for as
  long as it did precisely because nothing ran that would notice — it was dead, so
  it never showed up untranslated either. A lint rule or a test that greps the
  package sources for string literals outside the `i18n/` directory would make it
  real; the hard part is the allowlist, since keys, CSS class fragments and
  `data-` attribute values are all legitimately strings. It bites the next time a
  calculation returns a word instead of a `MessageKey`, which is a natural thing
  to write and currently nothing objects to.
- **Link previews for shared results.** Result URLs are permanent and worth
  sharing, but the SPA serves the same empty `index.html` to every crawler, so a
  pasted link shows nothing. Needs a small server-rendered route emitting OG/
  Twitter meta tags (title = "Po scored 37 taps at Fun Store", image = the
  generated score card). This is the piece that makes the share feature above
  actually spread.
- **Rate-limit the public reads.** `GET /games/{slug}/scores/{id}`,
  `GET /awards` and `GET /settings/public` are all unauthenticated, and the
  awards batch is hit on every landing-page load — it is the whole catalog's
  prize ladders in one response, so it is now the cheapest public request to
  make and the most expensive one to serve. Score ids are nanoid(11) — 66 bits, down from
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
- **Nothing NOTICES a win with no claim; the repair is manual.**
  `cmd/backfill-claims` closes the hole once someone runs it, and the player's
  side is built — a win with no claim renders the prize with
  `result.noClaimNote` (`ResultSummary`) — but nothing between those two ever
  raises its hand. `issueClaim` logs and returns nil, and a log line in
  `.prod/logs/api.log` is not a signal anybody watches, so the interval between
  a failed write and someone thinking to run the script is unbounded. In that
  window the counter still has no row to look up and no way to tell this player
  from someone inventing a prize. The cheap version is a `-check` mode that
  exits non-zero when any win lacks a claim, run from cron or from `ship.sh`;
  the real version is the metric in the observability entry above.
- **A win whose award was deleted can never be given a claim.** `partitionWins`
  (`cmd/backfill-claims`) sets those rounds aside and reports them rather than
  writing a row, because `award_name` is a snapshot and a deleted award leaves
  no name to snapshot — inventing one would put a lie in the one column designed
  to outlive the award. So a prize deleted before its claim was backfilled is
  unrecoverable, permanently. Soft-delete/archive is the fix and it is the same
  fix the entry below wants; this is a second, sharper reason for it, because
  here the data loss is already irreversible rather than merely confusing.

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
- **Setting copy is compiled in, so the panel and the database disagree about
  what a knob does.** `CAVEATS` in `SettingsPanel.tsx` explains the one setting
  whose effect is narrower than its name (`claim_ttl_hours` governs claims issued
  afterwards, never existing ones) — client-side, because seeded `description`
  rows are only written when absent and editing a seed never reaches a database
  that already has it. That is the right call for one caveat and the wrong shape
  for five: an operator now reads two sentences from two sources under one key,
  one editable in the admin and one only by deploying. It pairs with the strings
  panel below — whatever migrates the dictionaries should take these too.
- **`redeemed_at` records when, never who — and an undo records nothing at all.**
  The claims table has no actor column (`003_claims.sql`), and the admin API is
  one shared secret with no identities behind it, so "who handed this prize
  over?" is unanswerable by construction. Un-redeeming makes it worse in a
  specific way: `claimRepo.Unredeem` sets `redeemed_at` back to NULL, so the row
  afterwards is indistinguishable from one that was never collected — the
  correction erases its own evidence. That is deliberate (half an audit trail
  invites more trust than it earns) and it is why the undo is the strongest
  argument on this list for **Real auth** plus an audit log: one change buys the
  actor, the history, and a reason string. Same root cause as the award-delete
  audit gap below.
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
- **Nothing anywhere tests a QR being decoded from a camera.** `onBarcodeScanned`
  in `mobile/admin/app/claims.tsx` is the one step of scan-to-redeem no suite
  reaches: Maestro can tap the button that opens the camera but cannot hold a code
  in front of an emulator's simulated lens, and the web scanner cannot run on any
  origin this project serves (see the entry under "Reward system depth"). Every
  step after the lookup is shared with the typed path, so the untested surface is
  small — but it is the surface the feature is named after. Android's emulator can
  be fed a virtual scene, and `expo-camera` has no injection hook; the realistic
  options are a manual check on a real phone against a real player screen, or
  accepting it and writing that down. It bites the first time someone changes the
  scanner and believes a green gate.
- **The native claims screen cannot see expired claims.** Its filter is two
  buttons — outstanding and collected — because those are the two questions a
  counter asks; the web panel's four-way `<select>` also covers expired, which is
  a back-office question. Nothing is broken by the gap, but an operator asking
  "did this lapse?" has to reach for the browser.
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
  dropdown — and almost none of them is catchable by a DOM assertion. *Almost*:
  `horizontalOverflow` (`e2e/helpers/layout.ts`) catches the one sub-class that
  is measurable without a picture, an element extending past the viewport, and
  it names the offender. Overlap, collapse and colour are still invisible to it —
  two elements can sit exactly on top of each other with neither out of bounds.
  Playwright's
  `toHaveScreenshot()` would, but it needs a pinned container image for stable
  font rendering; deliberately deferred rather than half-done. **The icons made
  this cheaper without anyone aiming at it**: every mark on screen is now inline
  SVG from `packages/icons` rather than a font glyph the host resolves, so emoji
  rendering — which differed per machine and was the least pinnable input of the
  lot — is no longer one of the variables a baseline has to hold still. Note the
  admin has the worse record of the two apps and is now reachable to the suite,
  which changes what a baseline would be worth without changing what it costs.
- **Nothing warns at RUNTIME when a client and server simulation disagree, and
  the browser assertion that does is worth more than it looks.** Both
  server-scored games are pinned two ways — a golden fixture as pure functions, and
  one browser assertion comparing what the client drew against the score that came
  back (`stack.spec.ts`, and the Precision Stop case in `play-flow.spec.ts`).
  **The fixture is strictly the weaker of the two, and now demonstrably so**: it
  proved Stack's two simulations agreed as functions while the live game disagreed
  anyway, because `handleDrop` judged a drop from the previous frame's centre and
  reported a freshly-read timestamp. Identical arithmetic on different INPUTS is
  invisible to a fixture by construction, and it was the browser test that caught
  it — after a retry had been hiding it. Neither covers a real player on a real
  device, where the failure looks like the tower saying 7 during play and the
  result screen saying 6, and nothing reports it. A dev-only check in
  `RoundRunner` comparing the client's own preview against `result.score.value`
  and logging a mismatch would surface it at roughly no cost and cover every
  future Scorer game without another spec each. The obstacle is that
  `RoundRunner` deliberately knows nothing about any game's maths, so the preview
  would have to be something a game OFFERS — an optional field on the report, or a
  `data-` attribute the runner reads — rather than something the runner computes.
- **The admin's own forms are still verified one field at a time.** The branding
  form is now written through `writeBranding` (`e2e/helpers/admin.ts`), which
  makes a retry idempotent — but the awards form is not dirty-gated at all
  (`AwardForm.tsx` disables Save only while busy), so the two admin forms have
  different save semantics and a spec has to know which it is driving. Worth
  reconciling if a third form appears, not before.
- **Every E2E round costs a fixed, unskippable ending.** Do not trust a number
  written here — **re-derive it**: `grep -c 'playRound(' e2e/tests/*.spec.ts`,
  plus the specs that reach the same sequence by a different route because their
  game ends on a tap rather than a clock — Precision Stop, and now `stack.spec.ts`,
  which deliberately ends its rounds by MISSING rather than waiting out a 15s
  clock (`StackDurationMs`, the longest round in the catalog by 2.5×). A future
  long-round game should copy that: playing to the whistle would put the whole
  round length on the gate every run. That
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
  only ever compiled. Do not trust a count written here — **re-derive it**:
  `grep -c 'E2E SKIPPED' ` over whatever ship logs still exist, or simply note
  that no machine in use has had an emulator attached, so the honest number is
  every push since the Maestro step was added. That is the shape the problem
  actually takes: not one forgotten check, a standing one, and the count only
  ever grows.

### Small cleanups

- **Duplicate session on mount in dev.** React StrictMode double-invokes effects,
  so `RoundRunner` requests two sessions per round locally (visible in the API
  log). Harmless — the second token wins and sessions expire — but it makes dev
  logs misleading and would matter if session creation ever costs something.
