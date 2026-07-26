// CALCULATIONS: turning a claim's status, and a failed redemption, into what an
// admin standing at a counter should read.
//
// The status itself is never computed here. It is derived on the server from
// the server's clock and arrives on `ClaimView.status`; this module only picks
// words for it. See the note on ClaimView in @minigames/api-client.

import type { ClaimStatus, ClaimView } from "@minigames/api-client";

/** How prominent a claim's state should look in a list. */
export type ClaimTone = "on" | "off";

/** Short label for a claim's state, for a badge in the list. */
export function claimStatusLabel(status: ClaimStatus): string {
  switch (status) {
    case "redeemed":
      return "Collected";
    case "expired":
      return "Expired";
    default:
      return "Ready";
  }
}

/** Only an outstanding claim is emphasised — it is the one still owed. */
export function claimStatusTone(status: ClaimStatus): ClaimTone {
  return status === "issued" ? "on" : "off";
}

/** The backend wraps a refusal as "<sentinel>: <reason>". */
const REASON_SEPARATOR = ": ";

/**
 * Extracts the human half of a wrapped backend error.
 *
 * `app.RedeemClaim` returns `fmt.Errorf("%w: %s", ErrClaimNotRedeemable,
 * reason)`, so the wire message reads "claim not redeemable: this claim has
 * already been redeemed". The sentinel half is for code; the reason half is the
 * sentence to say out loud. Showing both makes an admin read a Go error name to
 * a customer.
 *
 * A message with no separator is passed through whole rather than emptied — a
 * reworded backend must degrade to "slightly clumsy", never to "blank".
 */
export function reasonFrom(message: string): string {
  const at = message.indexOf(REASON_SEPARATOR);
  if (at === -1) return message;
  const reason = message.slice(at + REASON_SEPARATOR.length).trim();
  return reason || message;
}

/**
 * What to show when redeeming fails.
 *
 * Each status is a different thing to do next, which is why they are not one
 * generic message: 404 means check the transcription, 409 means the claim is
 * real but spent, 401 means the admin's own session died mid-shift.
 */
export function redeemErrorMessage(status: number, message: string): string {
  switch (status) {
    case 404:
      return "No claim with that code. Check the characters and try again.";
    case 409:
      // The fallback matters: `Alert` renders nothing for an empty message, so
      // a 409 with no body would leave the admin watching a button do nothing
      // and conclude the code worked.
      return reasonFrom(message) || "That claim has already been used, or has expired.";
    case 401:
      return "Your admin session is no longer valid — sign in again.";
    default:
      return message || "Could not redeem that claim.";
  }
}

/**
 * What to show when UNDOING a redemption fails.
 *
 * Separate from `redeemErrorMessage` because the same status codes mean opposite
 * things here: a 409 on the way in is "already collected", and a 409 on the way
 * back is "nobody collected it". Reusing one function would have produced the
 * most confusing possible sentence for a counter — "already been used" in answer
 * to "give it back".
 */
export function unredeemErrorMessage(status: number, message: string): string {
  switch (status) {
    case 404:
      return "No claim with that code. Check the characters and try again.";
    case 409:
      return reasonFrom(message) || "That claim was not collected, so there is nothing to undo.";
    case 401:
      return "Your admin session is no longer valid — sign in again.";
    default:
      return message || "Could not undo that redemption.";
  }
}

/** The two things an admin can do to a claim from the counter. */
export type ClaimAction = "redeem" | "unredeem";

/** The wording of a confirmation step: what is being asked, and the button. */
export interface ClaimConfirmation {
  /** The question, naming the prize and the code — never a bare "Are you sure?". */
  question: string;
  /** The consequence, in one sentence. */
  note: string;
  /** The confirming button's label. */
  verb: string;
}

/**
 * The copy for confirming a redemption or its undo.
 *
 * A confirmation exists because of the camera: a scan is a trigger that a stray
 * angle can pull, and `POST /claims/{code}/redeem` hands a real prize to whoever
 * is standing there. So the prompt has to name **the prize and the code**, which
 * is the only way an operator can tell "the claim I meant" from "the claim that
 * happened to be in frame". `ClaimView` is the argument rather than a code
 * string precisely so this cannot be built without the prize name.
 *
 * The un-redeem note does NOT promise the prize becomes collectable again: a
 * claim whose window closed while it was marked collected comes back *expired*.
 * That is deliberately stated as a possibility rather than computed from the
 * device's clock — status is the server's answer everywhere else in this app and
 * a second definition here would be the one that disagrees.
 */
export function claimConfirmation(action: ClaimAction, view: ClaimView): ClaimConfirmation {
  const { claim } = view;
  if (action === "unredeem") {
    return {
      question: `Undo the collection of ${claim.awardName} for ${claim.code}?`,
      note: "The claim goes back to being outstanding, so it can be collected again. If its collection window has already closed it will come back as expired.",
      verb: "Undo collection",
    };
  }
  return {
    question: `Hand over ${claim.awardName} for ${claim.code}?`,
    note: "This marks the prize collected, and it can only be collected once.",
    verb: "Hand it over",
  };
}
