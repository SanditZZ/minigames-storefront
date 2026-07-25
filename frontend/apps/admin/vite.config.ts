import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// Shared packages resolve to TypeScript source, so editing one hot-reloads
// here without a build step. Mirrors the player app's config.
const pkg = (name: string) => fileURLToPath(new URL(`../../packages/${name}/src`, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@minigames/api-client": pkg("api-client"),
      "@minigames/admin-core": pkg("admin-core"),
    },
  },
  server: {
    port: 5174,
  },
});
