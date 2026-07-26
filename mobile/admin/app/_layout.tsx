import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { COLORS } from "@minigames/tokens";
import "../global.css";

/**
 * The app shell.
 *
 * Header colours come from @minigames/tokens rather than a class name because
 * expo-router's native header is a real platform view, not a NativeWind one —
 * it takes style objects. That is the shape of the whole port: the VALUES are
 * shared, the mechanism for applying them is per-platform.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS["brand-4"] },
          headerTintColor: COLORS.ink,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: COLORS["brand-4"] },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Awards" }} />
        {/* Pushed from the awards list rather than presented as a tab: the two
            screens answer unrelated questions, and a back button is the gesture
            staff already know. */}
        <Stack.Screen name="claims" options={{ title: "Claims" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
