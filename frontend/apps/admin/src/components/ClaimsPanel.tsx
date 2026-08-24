import { useCallback, useEffect, useState } from "react";
import type { ApiClient, ClaimView } from "@minigames/api-client";
import { ApiError } from "@minigames/api-client";
import {
  claimConfirmation,
  redeemErrorMessage,
  unredeemErrorMessage,
  type ClaimAction,
} from "@minigames/admin-core";
import type { ClaimStatusFilter } from "../router";
import { CLAIM_STATUS_VALUES } from "../router";
import { useCodeScanner } from "../scan/useCodeScanner";
import {
  Alert,
  Button,
  Card,
  ClaimRow,
  ConfirmPrompt,
  EmptyState,
  Input,
  Loading,
  PanelHeader,
  Select,
  Stack,
} from "../ui";

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

/** A claim the admin has asked to act on, and has not yet confirmed. */
interface Pending {
  action: ClaimAction;
  view: ClaimView;
}

/**
 * One side of the "All claims" board — the ticket-booth-counter split
 * (what's still out, what's already come back) an operator actually asks
 * about, rather than one flat list they have to scan. Only used for the "all"
 * filter; a specific status filter already answers that question by itself.
 */
function ClaimColumn({
  title,
  claims,
  busy,
  onRedeem,
  onUnredeem,
}: {
  title: string;
  claims: ClaimView[];
  busy: boolean;
  onRedeem: (view: ClaimView) => void;
  onUnredeem: (view: ClaimView) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink/50">{title}</h3>
      {claims.length === 0 ? (
        <p className="text-sm text-ink/40">None right now.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {claims.map((view) => (
            <ClaimRow
              key={view.claim.id}
              view={view}
              busy={busy}
              onRedeem={() => onRedeem(view)}
              onUnredeem={() => onUnredeem(view)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

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
 *
 * **Nothing here writes without a confirmation.** Redeeming has no inverse worth
 * relying on (there is an undo, but it cannot un-tell a customer their prize is
 * gone), and a camera can fire it at whatever happens to be in frame. So the
 * typed box, the row buttons and the scanner all converge on one `Pending` state
 * and one `ConfirmPrompt` that names the prize and the code.
 */
export function ClaimsPanel({ api, status, onStatusChange }: Props) {
  const [claims, setClaims] = useState<ClaimView[] | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ action: ClaimAction; view: ClaimView } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const load = useCallback(() => {
    setClaims(null);
    api
      .listClaims(status === "all" ? undefined : status)
      .then(setClaims)
      .catch(() => setClaims([]));
  }, [api, status]);

  useEffect(load, [load]);

  /**
   * Turns a bare code into a confirmable claim by looking it up.
   *
   * This is the only reason `GET /admin/claims/{code}` exists: a code alone
   * cannot say what prize it is, and "Hand over ABCD2345?" tells an operator
   * nothing they can check. A failure here is reported with the redeem wording
   * because a lookup is only ever the first half of one.
   */
  const propose = useCallback(
    async (raw: string, action: ClaimAction = "redeem") => {
      const value = raw.trim();
      if (!value || busy) return;

      setBusy(true);
      setError("");
      setDone(null);
      try {
        setPending({ action, view: await api.getClaim(value) });
      } catch (e) {
        setPending(null);
        setError(
          e instanceof ApiError
            ? redeemErrorMessage(e.status, e.message)
            : "Could not reach the server. Check the connection and try again.",
        );
      } finally {
        setBusy(false);
      }
    },
    [api, busy],
  );

  const scanner = useCodeScanner((value) => void propose(value));

  /**
   * Performs the confirmed action.
   *
   * The list is reloaded rather than patched in place: acting on a claim changes
   * which claims match the current filter (a collected one leaves "Outstanding"
   * entirely, and an undone one comes back into it), and editing one row in an
   * array that should no longer contain it is how a list starts lying.
   */
  async function commit({ action, view }: Pending) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result =
        action === "redeem"
          ? await api.redeemClaim(view.claim.code)
          : await api.unredeemClaim(view.claim.code);
      setDone({ action, view: result });
      setPending(null);
      setCode("");
      load();
    } catch (e) {
      // The claim stays on screen: a refusal ("someone else already collected
      // this") is exactly when the operator needs to keep looking at it.
      const message = action === "redeem" ? redeemErrorMessage : unredeemErrorMessage;
      setError(
        e instanceof ApiError
          ? message(e.status, e.message)
          : "Could not reach the server. Check the connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setPending(null);
    setError("");
  }

  return (
    <Stack>
      <PanelHeader title="Claims" />

      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void propose(code);
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
              {busy ? "Looking…" : "Look up"}
            </Button>
          </div>

          {/* The scan control is offered ONLY where the browser can actually do
              it. On this project's own stack it never is — plain HTTP means no
              camera API at all — so the panel says which of the three reasons
              applies rather than showing a button that fails on tap. See
              scanAvailability in @minigames/admin-core, and the native admin,
              which is not bound by any of it. */}
          {scanner.availability.kind === "ready" ? (
            <div className="mt-3">
              {scanner.scanning ? (
                <div className="flex flex-col gap-3">
                  {/* muted + playsInline: an unmuted autoplaying video is blocked
                      by every browser, and without playsInline iOS takes the
                      video fullscreen and hides the panel behind it. */}
                  <video
                    ref={scanner.videoRef}
                    muted
                    playsInline
                    aria-label="Camera preview"
                    className="aspect-video w-full max-w-sm rounded-xl bg-ink/5 object-cover"
                  />
                  <div>
                    <Button variant="ghost" onClick={scanner.stop} className="shrink-0 whitespace-nowrap">
                      Stop camera
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="ghost" onClick={scanner.start} className="shrink-0 whitespace-nowrap">
                  Scan a QR code
                </Button>
              )}
            </div>
          ) : (
            <p className="mt-3 text-xs text-ink/50">{scanner.availability.reason}</p>
          )}

          <Alert message={scanner.error} />
          <Alert message={error} />

          {pending && (
            <ConfirmPrompt
              {...claimConfirmation(pending.action, pending.view)}
              busy={busy}
              onConfirm={() => void commit(pending)}
              onCancel={cancel}
            />
          )}

          {done && (
            <p role="status" className="mt-3 rounded-lg bg-brand-3 px-3 py-2 text-sm font-medium text-ink">
              {done.action === "redeem" ? (
                <>
                  Handed over: <strong>{done.view.claim.awardName}</strong> ({done.view.claim.code})
                </>
              ) : (
                <>
                  {/* The resulting status comes from the response, not from a
                      guess: undoing a collection after the window closed lands on
                      "expired" rather than back on "outstanding". */}
                  Collection undone: <strong>{done.view.claim.awardName}</strong> ({done.view.claim.code}) is now{" "}
                  {done.view.status === "issued" ? "outstanding" : done.view.status}.
                </>
              )}
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
      ) : status === "all" ? (
        // The booth-counter board: outstanding on the left, everything no
        // longer outstanding (collected or lapsed) on the right — each row's
        // own badge still names its exact status.
        <div className="grid gap-4 sm:grid-cols-2">
          <ClaimColumn
            title="Outstanding"
            claims={claims.filter((view) => view.status === "issued")}
            busy={busy}
            onRedeem={(view) => setPending({ action: "redeem", view })}
            onUnredeem={(view) => setPending({ action: "unredeem", view })}
          />
          <ClaimColumn
            title="Collected"
            claims={claims.filter((view) => view.status !== "issued")}
            busy={busy}
            onRedeem={(view) => setPending({ action: "redeem", view })}
            onUnredeem={(view) => setPending({ action: "unredeem", view })}
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {claims.map((view) => (
            <ClaimRow
              key={view.claim.id}
              view={view}
              busy={busy}
              // A row already HAS the claim, so it goes straight to the
              // confirmation without a second request for what is on screen.
              onRedeem={() => setPending({ action: "redeem", view })}
              onUnredeem={() => setPending({ action: "unredeem", view })}
            />
          ))}
        </ul>
      )}
    </Stack>
  );
}
