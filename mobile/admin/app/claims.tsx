import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { ApiError, type ClaimView } from "@minigames/api-client";
import {
  claimConfirmation,
  claimStatusLabel,
  redeemErrorMessage,
  unredeemErrorMessage,
  type ClaimAction,
} from "@minigames/admin-core";
import { baseUrl, isConfigured, makeApi } from "../src/api";
import { useAdminToken } from "../src/useAdminToken";
import { ActionButton, Banner, ConfirmPrompt, NotConfigured, SignIn, Spinner } from "../src/ui";

/**
 * The counter's screen, and the reason this app is on a phone rather than only in
 * a browser.
 *
 * Everything about redeeming is shared with the web admin — `claimConfirmation`,
 * the two error-message functions and `claimStatusLabel` all come from
 * @minigames/admin-core, so the sentence an operator reads at a counter is the
 * same sentence whichever device they are holding. What is NOT shared is the one
 * thing that made this worth building: the camera.
 *
 * **The web scanner cannot run on this stack at all.** `navigator.mediaDevices`
 * does not exist on a plain-HTTP origin, and Chromium on Linux has no
 * `BarcodeDetector` — see `scanAvailability` in admin-core, which ranks those
 * reasons for the browser's benefit. `expo-camera` is bound by neither: it asks
 * the OS for permission and decodes natively. This screen is where scan-to-redeem
 * actually works.
 */
export default function ClaimsScreen() {
  const { state, signIn, reject } = useAdminToken();
  const [claims, setClaims] = useState<ClaimView[] | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<{ action: ClaimAction; view: ClaimView } | null>(null);
  const [done, setDone] = useState<{ action: ClaimAction; view: ClaimView } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const token = state.status === "ready" ? state.token : "";

  /** Reports a failure, and signs out if the token is what the server refused. */
  const fail = useCallback(
    async (e: unknown, phrase: (status: number, message: string) => string) => {
      if (e instanceof ApiError) {
        if (e.status === 401) {
          setError("That admin token was rejected.");
          await reject();
          return;
        }
        setError(phrase(e.status, e.message));
        return;
      }
      setError(e instanceof Error ? `Could not reach ${baseUrl || "the API"}: ${e.message}` : "Request failed.");
    },
    [reject],
  );

  /**
   * Which claims the list shows.
   *
   * Two states rather than the web panel's four. A phone at a counter answers two
   * questions — "what do I owe this person" and "I just collected the wrong one" —
   * and the second is why `redeemed` is here at all: without it the undo control
   * on a collected row could never appear, since a collected claim would never be
   * listed. Expired claims are a back-office question and are left to the web.
   *
   * It is component state, not a route parameter, which is the opposite of the
   * web admin's rule. That rule exists so a view can be linked to a colleague;
   * there is no address bar to paste here, and `expo-router` would make this a
   * navigation event for something that is one fetch.
   */
  const [filter, setFilter] = useState<"issued" | "redeemed">("issued");

  const load = useCallback(
    async (secret: string, status: "issued" | "redeemed") => {
      setClaims(null);
      try {
        // Never unfiltered: the endpoint returns every claim ever issued and
        // narrows in memory (see docs/potential-features.md), so asking for
        // everything gets slower every week the venue operates.
        setClaims(await makeApi(secret).listClaims(status));
      } catch (e) {
        setClaims([]);
        await fail(e, redeemErrorMessage);
      }
    },
    [fail],
  );

  useEffect(() => {
    if (token !== "") void load(token, filter);
  }, [token, filter, load]);

  /**
   * Looks a code up so the confirmation can name the prize.
   *
   * Both entry points land here — the typed box and the camera — because the
   * confirmation is the whole safeguard: a scan is a trigger a stray angle can
   * pull, and `redeem` has no inverse a customer would accept ("actually, give
   * that coffee back").
   */
  const propose = useCallback(
    async (raw: string) => {
      const value = raw.trim();
      if (value === "" || busy || token === "") return;
      setBusy(true);
      setError("");
      setDone(null);
      try {
        setPending({ action: "redeem", view: await makeApi(token).getClaim(value) });
      } catch (e) {
        setPending(null);
        await fail(e, redeemErrorMessage);
      } finally {
        setBusy(false);
      }
    },
    [busy, token, fail],
  );

  /**
   * The camera fires `onBarcodeScanned` for every frame it can read, so a single
   * code held up produces a stream of identical events. This ref is what turns
   * that into one lookup: it closes the gate before the first `propose` even
   * starts, because `setState` is async and a second frame can arrive first.
   */
  const scanned = useRef(false);

  function stopScanning() {
    setScanning(false);
    scanned.current = false;
  }

  async function startScanning() {
    setError("");
    // `granted` can be false with `canAskAgain` false — a permission refused
    // once is not re-askable from inside the app, so say so rather than opening a
    // camera view that will never show anything.
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setError(
          result.canAskAgain
            ? "Camera permission is needed to scan. Type the code instead."
            : "Camera permission was refused. Enable it in the system settings for this app, or type the code.",
        );
        return;
      }
    }
    scanned.current = false;
    setScanning(true);
  }

  async function commit(action: ClaimAction, view: ClaimView) {
    if (busy || token === "") return;
    setBusy(true);
    setError("");
    try {
      const api = makeApi(token);
      const result =
        action === "redeem" ? await api.redeemClaim(view.claim.code) : await api.unredeemClaim(view.claim.code);
      setDone({ action, view: result });
      setPending(null);
      setCode("");
      await load(token, filter);
    } catch (e) {
      // The claim stays on screen: a refusal ("someone already collected this")
      // is exactly when the operator needs to keep looking at it.
      await fail(e, action === "redeem" ? redeemErrorMessage : unredeemErrorMessage);
    } finally {
      setBusy(false);
    }
  }

  if (!isConfigured()) return <NotConfigured />;
  if (state.status === "loading") return <Spinner />;
  if (state.status === "signedOut") return <SignIn error={error} onSubmit={(t) => void signIn(t)} />;

  return (
    <View className="flex-1 bg-brand-4">
      <View className="gap-3 p-4">
        <Text className="text-sm font-bold text-ink">Redeem a code</Text>
        <Text className="text-xs text-ink/60">
          Type it as the customer reads it out, or scan the QR on their screen. Case and the dash don&rsquo;t matter.
        </Text>

        {/* gap-3 + shrink-0: the field must not touch the button at 320px, and
            the button must not collapse. Same rule as the web panel. */}
        <View className="flex-row items-center gap-3">
          <TextInput
            testID="claim-code-input"
            value={code}
            onChangeText={setCode}
            placeholder="ABCD-2345"
            placeholderTextColor="#4A2B2066"
            autoCapitalize="characters"
            autoCorrect={false}
            // A code is eight characters of a confusable-free alphabet, so a
            // spell-checked, auto-corrected field would fight the operator.
            spellCheck={false}
            className="min-w-0 flex-1 rounded-xl bg-white px-4 py-3 font-mono text-lg tracking-widest text-ink"
          />
          <ActionButton
            testID="claim-lookup"
            label={busy ? "…" : "Look up"}
            disabled={busy || code.trim() === ""}
            onPress={() => void propose(code)}
          />
        </View>

        <View className="flex-row items-center gap-3">
          <ActionButton
            testID={scanning ? "claim-scan-stop" : "claim-scan-start"}
            tone="ghost"
            label={scanning ? "Stop camera" : "Scan a QR code"}
            onPress={() => (scanning ? stopScanning() : void startScanning())}
          />
        </View>
      </View>

      {scanning && (
        <View className="mx-4 mb-4 overflow-hidden rounded-2xl bg-ink/5">
          <CameraView
            testID="claim-camera"
            facing="back"
            // Only QR. Letting it read every symbology means a barcode on the
            // packaging behind the phone can win the frame.
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => {
              if (scanned.current) return;
              scanned.current = true;
              // Stop before proposing: the confirmation must be about ONE claim,
              // and a camera left running would keep offering the next thing that
              // drifts into frame.
              setScanning(false);
              void propose(data);
            }}
            style={{ width: "100%", aspectRatio: 4 / 3 }}
          />
        </View>
      )}

      <Banner testID="claim-error" message={error} />

      {pending && (
        <ConfirmPrompt
          {...claimConfirmation(pending.action, pending.view)}
          busy={busy}
          onConfirm={() => void commit(pending.action, pending.view)}
          onCancel={() => {
            setPending(null);
            setError("");
          }}
        />
      )}

      {done && (
        <View testID="claim-done" className="m-4 rounded-xl bg-brand-3 p-3">
          <Text className="text-sm font-semibold text-ink">
            {done.action === "redeem"
              ? `Handed over: ${done.view.claim.awardName} (${done.view.claim.code})`
              : // The resulting status comes from the response, never a guess: an
                // undo after the collection window closed lands on "expired".
                `Collection undone: ${done.view.claim.awardName} (${done.view.claim.code}) is now ${
                  done.view.status === "issued" ? "outstanding" : done.view.status
                }.`}
          </Text>
        </View>
      )}

      {/* gap-3 so the two controls never touch at 320px, and each is a full
          tap target rather than a text link. */}
      <View className="flex-row items-center gap-3 px-4 pb-2">
        <ActionButton
          testID="filter-issued"
          tone={filter === "issued" ? "primary" : "ghost"}
          label="Outstanding"
          onPress={() => setFilter("issued")}
        />
        <ActionButton
          testID="filter-redeemed"
          tone={filter === "redeemed" ? "primary" : "ghost"}
          label="Collected"
          onPress={() => setFilter("redeemed")}
        />
      </View>

      {claims === null ? (
        <Spinner />
      ) : (
        <FlatList
          testID="claims-list"
          data={claims}
          keyExtractor={(view) => view.claim.id}
          contentContainerClassName="px-4 pb-8 gap-3"
          ListEmptyComponent={
            <Text className="py-8 text-center text-ink/50">
              {filter === "issued"
                ? "Nothing outstanding — claims appear here as players win them."
                : "Nothing collected yet."}
            </Text>
          }
          renderItem={({ item }) => (
            <ClaimRow
              view={item}
              busy={busy}
              onAct={(action) => {
                // A row already HOLDS the claim, so it confirms without a second
                // request for what is already on screen.
                setDone(null);
                setPending({ action, view: item });
              }}
            />
          )}
        />
      )}
    </View>
  );
}

/** One outstanding claim. Mirrors the web `ClaimRow`, built from RN primitives. */
function ClaimRow({
  view,
  busy,
  onAct,
}: {
  view: ClaimView;
  busy: boolean;
  onAct: (action: ClaimAction) => void;
}) {
  const { claim, status } = view;
  return (
    // Keyed on the CODE rather than the id: a code is what the operator is
    // looking at, and — unlike a nanoid minted at seed time — it is what a test
    // can be handed by the fixture that won it.
    <View testID={`claim-${claim.code}`} className="flex-row items-center gap-3 rounded-2xl bg-white p-4">
      <View className="min-w-0 flex-1">
        <Text className="font-mono text-base font-bold tracking-wider text-ink">{claim.code}</Text>
        <Text numberOfLines={1} className="mt-0.5 text-xs text-ink/60">
          {claim.awardName} · {claimStatusLabel(status)}
        </Text>
      </View>
      {status === "issued" ? (
        <ActionButton
          testID={`claim-redeem-${claim.code}`}
          label="Redeem"
          disabled={busy}
          onPress={() => onAct("redeem")}
        />
      ) : status === "redeemed" ? (
        <ActionButton
          testID={`claim-undo-${claim.code}`}
          tone="ghost"
          label="Undo"
          disabled={busy}
          onPress={() => onAct("unredeem")}
        />
      ) : null}
    </View>
  );
}
