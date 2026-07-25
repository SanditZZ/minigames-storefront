import { useCallback, useEffect, useState } from "react";
import type { ApiClient, ClaimView } from "@minigames/api-client";
import { ApiError } from "@minigames/api-client";
import { redeemErrorMessage } from "@minigames/admin-core";
import type { ClaimStatusFilter } from "../router";
import { CLAIM_STATUS_VALUES } from "../router";
import { Alert, Button, Card, ClaimRow, EmptyState, Input, Loading, PanelHeader, Select, Stack } from "../ui";

interface Props {
  api: ApiClient;
  /** Status filter from ?status=; "all" when unset. */
  status: ClaimStatusFilter;
  onStatusChange: (status: ClaimStatusFilter) => void;
}

const FILTER_LABELS: Record<ClaimStatusFilter, string> = {
  all: "All claims",
  issued: "Outstanding",
  redeemed: "Collected",
  expired: "Expired",
};

/**
 * The counter's panel: redeem a code someone is holding, and see what is
 * outstanding.
 *
 * The lookup box comes FIRST and the list second, because that is the order the
 * work actually happens in — a person is standing there with a code, and
 * scanning a list to find it would be the slow path for the common case. The
 * list answers the other question ("what have we not handed out?") and is the
 * only way to notice a prize nobody collected.
 *
 * The typed code is component state rather than a URL parameter, unlike every
 * other admin view. That is not an exception to the addressable-view rule: the
 * rule covers which VIEW is on screen — panel, filters, the award being edited
 * — and a half-typed code is form content, the same as the text inside the
 * award form's name field. The filter, which is a view, does live in the URL.
 */
export function ClaimsPanel({ api, status, onStatusChange }: Props) {
  const [claims, setClaims] = useState<ClaimView[] | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [redeemed, setRedeemed] = useState<ClaimView | null>(null);

  const load = useCallback(() => {
    setClaims(null);
    api
      .listClaims(status === "all" ? undefined : status)
      .then(setClaims)
      .catch(() => setClaims([]));
  }, [api, status]);

  useEffect(load, [load]);

  /**
   * Redeems a code, from the box or from a row's button.
   *
   * The list is reloaded rather than patched in place: redeeming changes which
   * claims match the current filter (an outstanding one leaves the "Outstanding"
   * view entirely), and editing one row in an array that should no longer
   * contain it is how a list starts lying.
   */
  async function redeem(raw: string) {
    const value = raw.trim();
    if (!value || busy) return;

    setBusy(true);
    setError("");
    setRedeemed(null);
    try {
      const view = await api.redeemClaim(value);
      setRedeemed(view);
      setCode("");
      load();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? redeemErrorMessage(e.status, e.message)
          : "Could not reach the server. Check the connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack>
      <PanelHeader title="Claims" />

      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void redeem(code);
          }}
        >
          <label htmlFor="claim-code" className="text-sm font-semibold text-ink">
            Redeem a code
          </label>
          <p className="mt-0.5 text-sm text-ink/60">
            Type it as the customer reads it out — case and the dash don&rsquo;t matter.
          </p>

          {/* gap-3 rather than justify-between: at 320px the field and the
              button must not touch, and the button must not collapse. */}
          <div className="mt-3 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <Input
                id="claim-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ABCD-2345"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="font-mono text-lg tracking-widest"
              />
            </div>
            <Button type="submit" disabled={busy || !code.trim()} className="shrink-0 whitespace-nowrap">
              {busy ? "Redeeming…" : "Redeem"}
            </Button>
          </div>

          <Alert message={error} />

          {redeemed && (
            <p role="status" className="mt-3 rounded-lg bg-brand-3 px-3 py-2 text-sm font-medium text-ink">
              Handed over: <strong>{redeemed.claim.awardName}</strong> ({redeemed.claim.code})
            </p>
          )}
        </form>
      </Card>

      <PanelHeader
        title={FILTER_LABELS[status]}
        action={
          <div className="w-44">
            <Select
              value={status}
              onChange={(e) => onStatusChange(e.target.value as ClaimStatusFilter)}
              aria-label="Filter claims by status"
            >
              {CLAIM_STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {FILTER_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {claims === null ? (
        <Card>
          <Loading />
        </Card>
      ) : claims.length === 0 ? (
        <EmptyState>
          {status === "all"
            ? "No prizes have been won yet — claims appear here as players win them."
            : `No ${FILTER_LABELS[status].toLowerCase()} claims.`}
        </EmptyState>
      ) : (
        <Card>
          <ul className="flex flex-col divide-y divide-ink/10">
            {claims.map((view) => (
              <ClaimRow
                key={view.claim.id}
                view={view}
                busy={busy}
                onRedeem={() => void redeem(view.claim.code)}
              />
            ))}
          </ul>
        </Card>
      )}
    </Stack>
  );
}
