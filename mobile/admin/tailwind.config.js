// NativeWind's Tailwind config — the native half of the palette rule in
// frontend/CLAUDE.md.
//
// The colours are REQUIRED from the shared tokens package, not retyped here, so
// `bg-brand` means the same hex on a phone as it does in the browser. That file
// is generated from packages/tokens/src/palette.ts; see scripts/tokens/ for why
// a JSON artifact exists rather than importing the TypeScript directly.
//
// Note this is Tailwind v3 while the web apps are on v4 — NativeWind 4 pins v3.
// The two never share a config file, only the values above, which is precisely
// why the values had to stop living inside a stylesheet.

const colors = require("@minigames/tokens/colors.json");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors,
    },
  },
  plugins: [],
};
