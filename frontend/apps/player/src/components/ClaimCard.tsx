import type { ClaimView } from "@minigames/api-client";
import { claimCopy, groupClaimCode } from "@minigames/player-core";
import { useLocale, useT, type Locale } from "../i18n";
import { Badge, Card, CopyButton, Eyebrow, PrizeImage } from "../ui";

/** Renders an ISO timestamp as a plain date in the app's language. Formatting a
 *  date is presentation; judging whether it has passed is not, and never
 *  happens here.
 *
 *  The locale is passed explicitly rather than left as `undefined` (which means
 *  "the device's"): the app can be pinned to a language the phone is not set
 *  to — that is the whole point of the pin — and a Thai page with an English
 *  month name is the seam that shows it. */
function onDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
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
export function ClaimCard({ view, imageUrl }: { view: ClaimView; imageUrl?: string }) {
  const t = useT();
  const { locale } = useLocale();
  const copy = claimCopy(view.status);
  const { claim } = view;
  const code = groupClaimCode(claim.code);

  return (
    <Card tone={copy.redeemable ? "solid" : "muted"} className="w-full max-w-sm text-center">
      {/* Unlike `awardName`, the image is NOT snapshotted — it is read from the
          award as it exists now, so deleting the prize drops back to the emoji.
          That asymmetry is deliberate: what the player won has to stay true
          forever, whereas a missing photo costs them nothing. */}
      <PrizeImage
        src={imageUrl}
        fallback={copy.redeemable ? "🎉" : "🎟️"}
        size="lg"
        muted={!copy.redeemable}
        className="mx-auto"
      />
      <Eyebrow className="mt-2">{t("result.won")}</Eyebrow>
      {/* The prize NAME is the claim's own snapshot of admin free text, so it
          reads as the operator typed it in every language. */}
      <div className="mt-1 text-2xl font-black text-ink">{claim.awardName}</div>

      <div className="mt-3">
        <Badge tone={copy.redeemable ? "brand" : "muted"}>{t(copy.labelKey)}</Badge>
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
          <CopyButton value={code} label={t("claim.codeLabel")} />
        </div>
      )}

      <p className="mt-3 text-sm text-ink/60">{t(copy.noteKey)}</p>

      {copy.redeemable && claim.expiresAt && (
        <p className="mt-1 text-xs font-medium text-ink/50">
          {t("claim.collectBy", { date: onDate(claim.expiresAt, locale) })}
        </p>
      )}
      {view.status === "redeemed" && claim.redeemedAt && (
        <p className="mt-1 text-xs font-medium text-ink/50">
          {t("claim.collectedOn", { date: onDate(claim.redeemedAt, locale) })}
        </p>
      )}
      {view.status === "expired" && claim.expiresAt && (
        <p className="mt-1 text-xs font-medium text-ink/50">
          {t("claim.expiredOn", { date: onDate(claim.expiresAt, locale) })}
        </p>
      )}
    </Card>
  );
}
