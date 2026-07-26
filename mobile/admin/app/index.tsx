import { useCallback, useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { Link } from "expo-router";
import { ApiError, UNLIMITED_STOCK, type Award } from "@minigames/api-client";
import { DEFAULT_LOCATION, visibleAwards } from "@minigames/admin-core";
import { baseUrl, isConfigured, makeApi } from "../src/api";
import { useAdminToken } from "../src/useAdminToken";
import { Banner, NotConfigured, SignIn, Spinner } from "../src/ui";

/**
 * The awards list — the screen that proved the road was open.
 *
 * It is deliberately the awards LIST rather than a placeholder, because the
 * list is the one screen that exercises all four things that could each have
 * silently not worked in a monorepo React Native setup:
 *
 *   1. Metro resolving @minigames/* out of frontend/packages (see metro.config)
 *   2. a shared CALCULATION — visibleAwards — running unchanged off-web
 *   3. NativeWind turning bg-brand into the same coral the browser renders
 *   4. the device actually reaching the API over plaintext HTTP (see app.config)
 *
 * Creating, editing and filtering prizes still live only on the web. What the
 * phone now does that the browser cannot is the next screen over: redeeming a
 * claim by pointing a camera at it.
 */
export default function AwardsScreen() {
  const { state, signIn, reject } = useAdminToken();
  const [awards, setAwards] = useState<Award[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(
    async (secret: string) => {
      setError("");
      setAwards(null);
      try {
        setAwards(await makeApi(secret).listAwards());
      } catch (e) {
        setAwards([]);
        if (e instanceof ApiError && e.status === 401) {
          setError("That admin token was rejected.");
          await reject();
          return;
        }
        setError(e instanceof Error ? `Could not reach ${baseUrl || "the API"}: ${e.message}` : "Request failed.");
      }
    },
    [reject],
  );

  useEffect(() => {
    if (state.status === "ready") void load(state.token);
  }, [state, load]);

  if (!isConfigured()) return <NotConfigured />;
  if (state.status === "loading") return <Spinner />;
  if (state.status === "signedOut") return <SignIn error={error} onSubmit={(t) => void signIn(t)} />;

  return (
    <View className="flex-1 bg-brand-4">
      <Banner message={error} />

      {/* The counter's screen is one tap away, and it is the reason this app is
          on a phone at all — see app/claims.tsx. */}
      <Link href="/claims" asChild>
        <Text testID="open-claims" className="px-4 pt-4 text-base font-bold text-ink underline">
          Redeem a claim →
        </Text>
      </Link>

      {awards === null ? (
        <Spinner />
      ) : (
        <FlatList
          testID="awards-list"
          data={visibleAwards(awards, DEFAULT_LOCATION, DEFAULT_LOCATION.sort)}
          keyExtractor={(a) => a.id}
          contentContainerClassName="p-4 gap-3"
          ListEmptyComponent={<Text className="py-8 text-center text-ink/50">No awards configured yet.</Text>}
          renderItem={({ item }) => <AwardRow award={item} />}
        />
      )}
    </View>
  );
}

/** One prize. Mirrors the web panel's row, built from RN primitives. */
function AwardRow({ award }: { award: Award }) {
  return (
    // gap-3 + min-w-0 + shrink-0, same rule as the web app: a long prize name
    // must truncate rather than push the stock badge off a narrow screen.
    //
    // The testID is composed from game + sortOrder rather than award.id: ids are
    // nanoids minted at seed time, so they differ on every fresh test database,
    // and a flow keyed on one would pass once and never again.
    <View
      testID={`award-${award.gameSlug || "any"}-${award.sortOrder}`}
      className="flex-row items-center gap-3 rounded-2xl bg-white p-4"
    >
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-base font-bold text-ink">
          {award.name}
        </Text>
        <Text className="mt-0.5 text-xs text-ink/60">
          {award.gameSlug === "" ? "Any game" : award.gameSlug} · reach {award.minScore}
        </Text>
      </View>

      <View className={`shrink-0 rounded-full px-3 py-1 ${award.active ? "bg-brand" : "bg-ink/10"}`}>
        <Text className="text-xs font-bold text-ink">{award.stock === UNLIMITED_STOCK ? "∞" : award.stock}</Text>
      </View>
    </View>
  );
}
