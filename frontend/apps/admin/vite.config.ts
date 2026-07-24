import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const apiClientSrc = fileURLToPath(new URL("../../packages/api-client/src", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@minigames/api-client": apiClientSrc,
    },
  },
  server: {
    port: 5174,
  },
});
