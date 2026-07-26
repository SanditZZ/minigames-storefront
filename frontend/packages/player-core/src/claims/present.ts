// CALCULATIONS: how a prize claim is presented to the player.
//
// The boundary this file defends is worth stating, because it is easy to cross
// by accident: a claim's STATUS is derived on the server and arrives already
// computed (`ClaimView.status`). Nothing here recomputes it, and nothing here
// takes a `now`. Deriving "expired" needs a clock, and the only clock this code
// can reach is the device's — which the player owns. A phone with its date
// wound back would show a lapsed prize as collectable.
//
// So these functions turn a status the server decided into words and shapes.
// Formatting the expiry DATE is fine and stays in the component; judging
// whether that date has passed is not, and never happens on this side.

import type { ClaimStatus } from "@minigames/api-client";
import type { MessageKey } from "../i18n";

/**
 * Splits a claim code into readable groups: "ABCD2345" → "ABCD-2345".
 *
 * Codes are read aloud and typed at a counter, and eight unbroken characters is
 * where transcription starts to slip. The grouping is display-only — the
 * backend normalises the dash away, so a player can type what they see.
 *
 * Anything that is not the expected length is returned untouched rather than
 * chopped at an arbitrary point: a wrong-length code is a bug worth seeing, not
 * one worth prettifying.
 */
export function groupClaimCode(code: string): string {
  if (code.length !== 8) return code;
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * What the result screen should say and do about a claim.
 *
 * The two strings are message KEYS rather than text. This function decides
 * WHICH sentence a claim state earns — a decision, and so a calculation worth
 * testing — while the sentence itself is a translation, which is the
 * dictionary's business (../i18n). Returning prose here would have pinned this
 * package to one language, and it is the package a native client reuses
 * verbatim.
 */
export interface ClaimCopy {
  /** Whether the code is still worth showing to staff. */
  redeemable: boolean;
  /** The line under the code. */
  noteKey: MessageKey;
  /** Short label for the state, shown beside the code when it is not live. */
  labelKey: MessageKey;
}

/**
 * The copy for each claim state.
 *
 * All three states still show the win — that is the decision behind snapshotting
 * the award name in the first place. A player who collected their coffee last
 * week, or who let the claim lapse, still won it; a page that suddenly denied
 * the win would read as broken and would be, in the plainest sense, wrong.
 * What changes is whether the CODE is presented as live.
 */
export function claimCopy(status: ClaimStatus): ClaimCopy {
  switch (status) {
    case "redeemed":
      return {
        redeemable: false,
        labelKey: "claim.label.collected",
        noteKey: "claim.note.collected",
      };
    case "expired":
      return {
        redeemable: false,
        labelKey: "claim.label.expired",
        noteKey: "claim.note.expired",
      };
    default:
      return {
        redeemable: true,
        labelKey: "claim.label.ready",
        noteKey: "claim.note.ready",
      };
  }
}
