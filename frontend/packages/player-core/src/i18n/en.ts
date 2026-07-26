// DATA layer: the player app's English copy, and the reference every other
// locale is measured against.
//
// This file is the CLIENT half of the split described in
// backend/internal/i18n: chrome lives here — buttons, headings, the reveal's
// tier ladder, the words a game says while it is being played — because
// round-tripping a button label through HTTP would make every screen wait on
// the network for its own furniture. Anything the SERVER already decides (game
// names, score units, the errors a failed round produces) is translated there
// and arrives ready to render.
//
// Keys are namespaced by the screen or component that shows them, so a screen
// deleted tomorrow takes its strings with it and does not leave orphans behind.
// `{name}`-style placeholders are filled by `format` in ./translate.
//
// `as const` is load-bearing: it is what makes MessageKey a union of these
// exact keys, so `t("home.titel")` is a type error and a Thai dictionary
// missing a key does not compile.
export const en = {
  // --- App shell ---------------------------------------------------------
  "app.notFound.title": "Page not found",
  "app.notFound.detail": "That link doesn’t go anywhere.",
  "app.notFound.action": "Play a game",
  "app.backendUnreachable": "Is the backend running?",

  // --- Language switcher -------------------------------------------------
  "language.label": "Language",
  "language.switchTo": "Switch to {language}",

  // --- Store identity, when the operator has set none --------------------
  "brand.name": "Fun Store",
  "brand.tagline": "Thanks for shopping with us — try your luck!",

  // --- Landing screen ----------------------------------------------------
  "home.title": "Play & Win 🎁",
  "home.loading": "Loading games…",
  "home.unreachable.title": "Can’t reach the games",
  "home.unreachable.action": "Try again",
  "home.refresh": "Refresh store details",
  "home.refreshing": "Refreshing…",
  "home.nameLabel": "Your name (optional)",
  "home.play": "Play",
  "home.soon": "Soon",
  "home.prizes.title": "Today's prizes",
  "home.prizes.soldOut": "Sold out",

  /**
   * The display name recorded for a player who typed none.
   *
   * Deliberately the SAME string in every locale, and deliberately used for
   * both the placeholder and the value actually submitted. It is data, not
   * chrome: it is written to the scores table and then read by everyone who
   * looks at that leaderboard, so a Thai player's round would otherwise appear
   * under a name an English player cannot read, and the placeholder would be
   * promising something the board does not show.
   */
  "player.guest": "Guest",

  // --- Play screen and the round runner ----------------------------------
  "play.loading": "Getting ready…",
  "play.notFound.title": "Game not found",
  "play.notFound.detail": "That game isn’t available right now.",
  "play.notFound.action": "See all games",
  "play.unsupported.title": "Not available yet",
  "play.unsupported.detail": "This game isn’t in this app version yet.",
  "play.failed.title": "Something went wrong",
  "play.back": "Back",
  "play.startFailed": "Could not start the game.",
  "play.submitFailed": "Could not submit your score.",
  "play.playingAs": "Playing as {name}",
  "play.quit": "Quit",
  "play.quitConfirm": "Sure?",
  "play.quitConfirmAria": "Confirm quitting this round",
  "play.secondsLeft": "{seconds}s left",

  // --- Countdown ---------------------------------------------------------
  "countdown.go": "GO!",
  "countdown.starting": "Starting in {seconds} seconds",

  // --- The beat between the round and the score --------------------------
  "complete.aria": "Game complete. Your score is on its way.",
  "complete.eyebrow": "Round over",
  "complete.title": "Game complete!",
  "complete.scoring": "Scoring…",
  "complete.revealing": "Revealing your score…",

  // --- Score reveal ------------------------------------------------------
  "reveal.aria": "Revealing your score.",
  "reveal.measuring": "Measuring…",
  "reveal.holdTight": "Hold tight…",
  "reveal.tier.warmingUp": "Warming up",
  "reveal.tier.notBad": "Not bad",
  "reveal.tier.sharp": "Sharp",
  "reveal.tier.onFire": "On fire",
  "reveal.tier.superstar": "Superstar",
  "reveal.tier.recordBreaker": "Record breaker",

  // --- Result screen -----------------------------------------------------
  "result.loading": "Loading…",
  "result.loadingScore": "Loading your score…",
  "result.notFound.title": "Result not found",
  "result.notFound.detail": "This score link may have expired or been mistyped.",
  "result.notFound.action": "Play a game",
  "result.topScore": "🏆 Top score",
  "result.rank": "Rank #{rank}",
  "result.playAgain": "Play again",
  "result.pickAnother": "Pick another game",
  "result.won": "You won",
  "result.noClaimNote":
    "No claim code was issued for this round — show this screen to staff and they can sort it out.",
  "result.noPrize.title": "So close!",
  "result.noPrize.body": "No prize this time — give it another go for a higher score.",

  // --- Leaderboard -------------------------------------------------------
  "board.title": "Top players",
  "board.loading": "Loading…",
  "board.empty": "Be the first on the board!",

  // --- Prize claim -------------------------------------------------------
  "claim.label.ready": "Ready to collect",
  "claim.label.collected": "Collected",
  "claim.label.expired": "Expired",
  "claim.note.ready": "Show this code at the counter to collect your prize.",
  "claim.note.collected": "You've already picked this one up. Nice.",
  "claim.note.expired": "This claim ran out of time. Ask staff if that looks wrong.",
  "claim.codeLabel": "claim code",
  "claim.collectBy": "Collect by {date}",
  "claim.collectedOn": "Collected {date}",
  "claim.expiredOn": "Expired {date}",

  // --- Copy button -------------------------------------------------------
  "copy.label": "code",
  "copy.idle": "Copy",
  "copy.copied": "Copied",
  "copy.failed": "Select it instead",
  "copy.aria": "Copy the {label}",
  "copy.announceCopied": "{label} copied",
  "copy.announceFailed": "could not copy the {label}",

  // --- Tap Fast ----------------------------------------------------------
  "tapFast.tap": "TAP!",

  // --- Reaction Timer ----------------------------------------------------
  "reaction.now": "Now!",
  "reaction.wait": "Wait for it…",
  "reaction.tooSoon": "Too soon! Waiting again…",
  "reaction.tap": "TAP!",
  "reaction.hold": "WAIT",
  "reaction.ariaGo": "Tap now",
  "reaction.ariaWait": "Wait for the signal, then tap",
  "reaction.hintGo": "Tap the moment it turns coral",
  "reaction.hintWait": "Don’t tap until the circle lights up",

  // --- Precision Stop ----------------------------------------------------
  "precision.aim": "Stop it dead centre",
  "precision.hint": "The closer you land, the lower your score",
  "precision.outOfTime": "Out of time",
  "precision.offCentre": "{off} off centre",
  "precision.stop": "STOP!",
  "precision.aria": "Stop the marker as close to the centre of the track as you can",
  "precision.timeLeft": "Time left to stop the marker",
  "precision.verdict.perfect": "Perfect",
  "precision.verdict.deadOn": "Dead on",
  "precision.verdict.close": "Close",
  "precision.verdict.near": "Near",
  "precision.verdict.wide": "Wide",
} as const;

/** Every string the client owns. `t` accepts nothing else. */
export type MessageKey = keyof typeof en;

/** A complete dictionary. Every locale must satisfy this, so none can be partial. */
export type Messages = Record<MessageKey, string>;
