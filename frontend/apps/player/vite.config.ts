import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// The shared api-client is consumed as TypeScript source via an alias, so
// editing it hot-reloads here with no separate build step.
const apiClientSrc = fileURLToPath(new URL("../../packages/api-client/src", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@minigames/api-client": apiClientSrc,
    },
  },
  server: {
    port: 5173,
  },
});
