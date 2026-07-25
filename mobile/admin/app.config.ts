import type { ExpoConfig } from "expo/config";

/**
 * The admin client's native configuration.
 *
 * Two entries here exist purely because an installed app is held to rules a
 * browser tab is not, and both would otherwise fail on first launch against
 * this stack:
 *
 *   - iOS App Transport Security blocks plaintext HTTP outright.
 *   - Android has blocked cleartext by default since API 28.
 *
 * The API is served over plain HTTP on a Tailscale address (see
 * scripts/serve-prod.sh), so both exceptions are opened below. They are scoped
 * as narrowly as the platforms allow and are correct ONLY for internal
 * distribution over a private tailnet. Putting this app in front of anyone
 * outside that means terminating TLS at the API and deleting both exceptions —
 * not widening them.
 */
const config: ExpoConfig = {
  name: "Store Admin",
  slug: "minigames-admin",
  version: "0.1.0",
  orientation: "default",
  // Matches the web admin's generated icon set — the ink field with the apricot
  // mark, so the two admin surfaces read as one product.
  icon: "./assets/icon.png",
  scheme: "minigames-admin",
  userInterfaceStyle: "light",

  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.funstore.minigames.admin",
    infoPlist: {
      NSAppTransportSecurity: {
        // Scoped to local/private networks rather than NSAllowsArbitraryLoads,
        // which would disable ATS for every host the app ever talks to.
        NSAllowsLocalNetworking: true,
      },
    },
  },

  android: {
    package: "com.funstore.minigames.admin",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#4A2B20",
    },
  },

  plugins: [
    "expo-router",
    "expo-status-bar",
    "expo-secure-store",
    // Android's equivalent of the ATS exception above. It is a native build
    // property rather than an app.config key, so it only takes effect in a
    // development or EAS build — never in Expo Go, whose own manifest this
    // cannot rewrite. If the awards list loads in a dev build and not in Expo
    // Go, this is why.
    ["expo-build-properties", { android: { usesCleartextTraffic: true } }],
  ],

  experiments: {
    typedRoutes: true,
  },

  extra: {
    /**
     * The API the app talks to. A device cannot resolve `localhost` to this
     * machine — it resolves it to ITSELF — so there is no useful default here;
     * the Tailscale address is baked in at build time from the same value
     * scripts/serve-prod.sh prints. Override per build with EXPO_PUBLIC_API_URL.
     */
    apiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? "",
  },
};

export default config;
