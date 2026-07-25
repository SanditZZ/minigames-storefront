// CALCULATIONS: turning a claim's status, and a failed redemption, into what an
// admin standing at a counter should read.
//
// The status itself is never computed here. It is derived on the server from
// the server's clock and arrives on `ClaimView.status`; this module only picks
// words for it. See the note on ClaimView in @minigames/api-client.

import type { ClaimStatus } from "@minigames/api-client";

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
