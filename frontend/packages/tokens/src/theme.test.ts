import { describe, expect, it } from "vitest";
import { COLORS, PALETTE } from "./palette.ts";
import { MOTION, cssEasing } from "./motion.ts";
import { themeCss } from "./theme.ts";

describe("palette", () => {
  // The mandatory palette in frontend/CLAUDE.md, pinned. This is the one test
  // whose job is to fail on a well-meaning edit: a colour changing here changes
  // every screen of every app at once, so it should never happen by accident.
  it("is exactly the five documented brand colours", () => {
    expect(COLORS).toEqual({
      brand: "#FF9A86",
      "brand-2": "#FFB399",
      "brand-3": "#FFD6A6",
      "brand-4": "#FFF0BE",
      ink: "#4A2B20",
    });
  });

  it("keeps a role on every token, so the rule travels with the value", () => {
    for (const token of Object.values(PALETTE)) {
      expect(token.role).not.toBe("");
    }
  });
});

describe("cssEasing", () => {
  it("expands a named curve to a cubic-bezier", () => {
    expect(cssEasing("back")).toBe("cubic-bezier(0.34, 1.56, 0.64, 1)");
  });

  it("passes a CSS keyword through untouched", () => {
    expect(cssEasing("ease-in-out")).toBe("ease-in-out");
  });
});

describe("themeCss", () => {
  it("emits every colour as a Tailwind token", () => {
    const css = themeCss({ motion: false });
    for (const key of Object.keys(COLORS)) {
      expect(css).toContain(`--color-${key}:`);
    }
  });

  // Matches a declaration, not the substring: the generated header explains
  // what --animate-* means, so a plain `toContain` check passes on the comment.
  const ANIMATE_DECL = /^\s+--animate-[a-z-]+:/m;

  it("omits the motion kit when an app has no keyframes", () => {
    expect(themeCss({ motion: false })).not.toMatch(ANIMATE_DECL);
  });

  it("emits motion declarations, not just the explanatory header", () => {
    expect(themeCss({ motion: true })).toMatch(ANIMATE_DECL);
  });

  it("emits every motion token when asked", () => {
    const css = themeCss({ motion: true });
    for (const key of Object.keys(MOTION)) {
      expect(css).toContain(`--animate-${key}:`);
    }
  });

  it("writes sub-second durations in ms and longer ones in s", () => {
    const css = themeCss({ motion: true });
    expect(css).toContain("--animate-pop-in: pop-in 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both;");
    expect(css).toContain("--animate-halo: halo 1.8s ease-out infinite;");
  });

  // `forwards` is what keeps confetti and the floating "+1" gone once they
  // finish; dropping it makes the particles reappear at full opacity.
  it("preserves each animation's fill mode", () => {
    const css = themeCss({ motion: true });
    expect(css).toContain("--animate-confetti: confetti 1.6s cubic-bezier(0.25, 0.6, 0.4, 1) forwards;");
    expect(css).toContain("--animate-float-up: float-up 650ms cubic-bezier(0.22, 1, 0.36, 1) forwards;");
    expect(css).toContain("--animate-bob: bob 2.4s ease-in-out infinite;");
  });

  it("is deterministic, so regenerating never shows up as a diff", () => {
    expect(themeCss({ motion: true })).toBe(themeCss({ motion: true }));
  });
});
