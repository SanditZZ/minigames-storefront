import type { ClaimView } from "@minigames/api-client";
import { claimCopy, groupClaimCode } from "@minigames/player-core";
import { Badge, Card, CopyButton, Eyebrow } from "../ui";

/** Renders an ISO timestamp as a plain date. Formatting a date is presentation;
 *  judging whether it has passed is not, and never happens here. */
function onDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * The prize a round won, and the code that collects it.
 *
 * This replaced "Show this screen at the counter to claim your prize", which
 * was a screenshot away from being reusable — the screen was the credential.
 * Now the credential is a code the server issued and can mark used exactly once.
 *
 * All three claim states still show the win. The prize name comes from the
 * claim's own snapshot (`awardName`), not from re-resolving the award, so
 * deleting the prize later cannot rewrite what this page says was won. What
 * changes between states is whether the code is presented as live — see
 * `claimCopy` in @minigames/player-core, which owns that wording.
 *
 * The status arrives from the server already derived. Nothing here compares
 * `expiresAt` to the clock: the only clock available is the device's, and a
 * phone with its date wound back would show a lapsed prize as collectable.
 */
export function ClaimCard({ view }: { view: ClaimView }) {
  const copy = claimCopy(view.status);
  const { claim } = view;
  const code = groupClaimCode(claim.code);

  return (
    <Card tone={copy.redeemable ? "solid" : "muted"} className="w-full max-w-sm text-center">
      <div className="text-4xl" aria-hidden>
        {copy.redeemable ? "🎉" : "🎟️"}
      </div>
      <Eyebrow className="mt-2">You won</Eyebrow>
      <div className="mt-1 text-2xl font-black text-ink">{claim.awardName}</div>

      <div className="mt-3">
        <Badge tone={copy.redeemable ? "brand" : "muted"}>{copy.label}</Badge>
      </div>

      {/* `select-text` is deliberate and load-bearing: it re-enables selection
          that the game surfaces switch off, so a player can always drag-select
          the code even if the copy button fails. `tracking` and `tabular-nums`
          are what make eight characters transcribable by someone reading them
          aloud across a counter. */}
      <div
        className={`mt-4 select-text rounded-xl px-3 py-3 font-mono text-3xl font-black tabular-nums tracking-[0.2em] ${
          copy.redeemable ? "bg-brand-4 text-ink" : "bg-ink/5 text-ink/40 line-through"
        }`}
      >
        {code}
      </div>

      {copy.redeemable && (
        <div className="mt-2 flex justify-center">
          {/* The grouped form is copied, not the raw code: it is what the player
              is looking at, and the backend normalises the dash away — so what
              they paste and what they read are the same string. */}
          <CopyButton value={code} label="claim code" />
        </div>
      )}

      <p className="mt-3 text-sm text-ink/60">{copy.note}</p>

      {copy.redeemable && claim.expiresAt && (
        <p className="mt-1 text-xs font-medium text-ink/50">Collect by {onDate(claim.expiresAt)}</p>
      )}
      {view.status === "redeemed" && claim.redeemedAt && (
        <p className="mt-1 text-xs font-medium text-ink/50">Collected {onDate(claim.redeemedAt)}</p>
      )}
      {view.status === "expired" && claim.expiresAt && (
        <p className="mt-1 text-xs font-medium text-ink/50">Expired {onDate(claim.expiresAt)}</p>
      )}
    </Card>
  );
}
