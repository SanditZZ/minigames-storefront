import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { ApiError, UNLIMITED_STOCK, type Award } from "@minigames/api-client";
import { DEFAULT_LOCATION, visibleAwards } from "@minigames/admin-core";
import { baseUrl, clearToken, getToken, isConfigured, makeApi, setToken } from "../src/api";

/**
 * The walking skeleton: one real screen, on real data, through every layer the
 * finished app will use.
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
 * What it is NOT is the admin app. Creating, editing, filtering and the other
 * panels all still live only on the web; this proves the road is open, it does
 * not drive down it.
 */
export default function AwardsScreen() {
  const [token, setTok] = useState<string | null>(null);
  const [awards, setAwards] = useState<Award[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getToken().then(setTok);
  }, []);

  const load = useCallback(async (secret: string) => {
    setError("");
    setAwards(null);
    try {
      setAwards(await makeApi(secret).listAwards());
    } catch (e) {
      setAwards([]);
      if (e instanceof ApiError && e.status === 401) {
        setError("That admin token was rejected.");
        await clearToken();
        setTok("");
        return;
      }
      setError(e instanceof Error ? `Could not reach ${baseUrl || "the API"}: ${e.message}` : "Request failed.");
    }
  }, []);

  useEffect(() => {
    if (token) void load(token);
  }, [token, load]);

  if (!isConfigured()) {
    return (
      <Notice
        title="No API host baked in"
        body="This build has no apiBaseUrl. Rebuild with EXPO_PUBLIC_API_URL set to the address the phone can reach — the Tailscale IP that serve-prod.sh prints, never localhost."
      />
    );
  }

  if (token === null) return <Centered><ActivityIndicator color="#4A2B20" /></Centered>;
  if (token === "") return <SignIn error={error} onSubmit={async (t) => { await setToken(t); setTok(t); }} />;

  return (
    <View className="flex-1 bg-brand-4">
      {error !== "" && (
        <View className="m-4 rounded-xl bg-brand p-3">
          <Text className="text-sm font-semibold text-ink">{error}</Text>
        </View>
      )}

      {awards === null ? (
        <Centered><ActivityIndicator color="#4A2B20" /></Centered>
      ) : (
        <FlatList
          data={visibleAwards(awards, DEFAULT_LOCATION, DEFAULT_LOCATION.sort)}
          keyExtractor={(a) => a.id}
          contentContainerClassName="p-4 gap-3"
          ListEmptyComponent={
            <Text className="py-8 text-center text-ink/50">No awards configured yet.</Text>
          }
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
    <View className="flex-row items-center gap-3 rounded-2xl bg-white p-4">
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-base font-bold text-ink">
          {award.name}
        </Text>
        <Text className="mt-0.5 text-xs text-ink/60">
          {award.gameSlug === "" ? "Any game" : award.gameSlug} · reach {award.minScore}
        </Text>
      </View>

      <View className={`shrink-0 rounded-full px-3 py-1 ${award.active ? "bg-brand" : "bg-ink/10"}`}>
        <Text className="text-xs font-bold text-ink">
          {award.stock === UNLIMITED_STOCK ? "∞" : award.stock}
        </Text>
      </View>
    </View>
  );
}

function SignIn({ error, onSubmit }: { error: string; onSubmit: (token: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <Centered>
      <View className="w-full max-w-sm gap-3">
        <Text className="text-xl font-bold text-ink">Admin sign in</Text>
        <Text className="text-sm text-ink/60">
          The shared secret for {baseUrl}. Stored in the device keychain, not in app storage.
        </Text>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="Admin token"
          placeholderTextColor="#4A2B2066"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          className="rounded-xl bg-white px-4 py-3 text-ink"
        />
        {error !== "" && <Text className="text-sm font-semibold text-ink">{error}</Text>}
        <Pressable
          disabled={value === ""}
          onPress={() => onSubmit(value)}
          className={`rounded-xl px-4 py-3 ${value === "" ? "bg-ink/10" : "bg-brand"}`}
        >
          <Text className="text-center text-base font-bold text-ink">Sign in</Text>
        </Pressable>
      </View>
    </Centered>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <Centered>
      <Text className="text-lg font-bold text-ink">{title}</Text>
      <Text className="mt-2 text-center text-sm text-ink/70">{body}</Text>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View className="flex-1 items-center justify-center bg-brand-4 p-6">{children}</View>;
}
