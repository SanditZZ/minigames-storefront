import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// The shared packages are consumed as TypeScript source via aliases, so editing
// one hot-reloads here with no separate build step. player-core holds this
// app's data + calculation layers — the half a native client will reuse
// verbatim — which makes editing it mid-session the common case, not a rare one.
const pkg = (name: string) => fileURLToPath(new URL(`../../packages/${name}/src`, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@minigames/api-client": pkg("api-client"),
      "@minigames/player-core": pkg("player-core"),
    },
  },
  server: {
    port: 5173,
  },
});
