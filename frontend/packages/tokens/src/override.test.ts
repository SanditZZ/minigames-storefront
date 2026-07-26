import { describe, expect, it } from "vitest";
import { PALETTE } from "./palette.ts";
import {
  COLOR_SETTING_KEYS,
  COLOR_SETTING_KEY_LIST,
  isHexColor,
  normalizeHex,
  paletteCssVars,
  paletteOverrides,
  resolvePalette,
} from "./override.ts";

describe("isHexColor", () => {
  it("accepts three- and six-digit hex in either case", () => {
    for (const ok of ["#abc", "#ABC", "#a1b2c3", "#FF9A86", "  #fff  "]) {
      expect(isHexColor(ok), ok).toBe(true);
    }
  });

  // The rejections that matter: every one of these is valid CSS a browser would
  // happily apply, and these values are written into a live custom property.
  it("rejects any CSS that is not a hex literal", () => {
    for (const bad of [
      "red",
      "rgb(255,0,0)",
      "var(--color-ink)",
      "#12345",
      "#gggggg",
      "url(x)",
      "#fff;background:url(x)",
      "",
      "   ",
    ]) {
      expect(isHexColor(bad), bad).toBe(false);
    }
  });
});

describe("normalizeHex", () => {
  it("lowercases and trims a real value", () => {
    expect(normalizeHex(" #FF9A86 ")).toBe("#ff9a86");
  });

  it("returns null for anything that is not a colour", () => {
    expect(normalizeHex("nope")).toBeNull();
    expect(normalizeHex(undefined)).toBeNull();
  });
});

describe("the precedence rule", () => {
  it("uses the token when no override is set", () => {
    expect(resolvePalette(null)).toEqual({
      brand: "#ff9a86",
      "brand-2": "#ffb399",
      "brand-3": "#ffd6a6",
      "brand-4": "#fff0be",
      ink: "#4a2b20",
    });
  });

  it("lets a valid setting win over the token", () => {
    const resolved = resolvePalette({ [COLOR_SETTING_KEYS.brand]: "#123456" });
    expect(resolved.brand).toBe("#123456");
    // …and only that one.
    expect(resolved.ink).toBe(PALETTE.ink.value.toLowerCase());
  });

  // The failure this prevents: a typo in the admin's colour box blanking the
  // whole app to an invalid custom property rather than falling back.
  it("ignores a malformed override rather than applying it", () => {
    const resolved = resolvePalette({ [COLOR_SETTING_KEYS.brand]: "not-a-colour" });
    expect(resolved.brand).toBe(PALETTE.brand.value.toLowerCase());
  });

  it("treats a blank value as cleared, not as black", () => {
    expect(resolvePalette({ [COLOR_SETTING_KEYS.ink]: "   " }).ink).toBe(
      PALETTE.ink.value.toLowerCase(),
    );
  });
});

describe("paletteOverrides", () => {
  it("reports only what the operator actually set", () => {
    expect(
      paletteOverrides({
        [COLOR_SETTING_KEYS["brand-2"]]: "#ABCDEF",
        [COLOR_SETTING_KEYS.ink]: "bogus",
        store_name: "Corner Cafe",
      }),
    ).toEqual({ "brand-2": "#abcdef" });
  });

  it("is empty for a store that has never opted out", () => {
    expect(paletteOverrides({})).toEqual({});
    expect(paletteOverrides(undefined)).toEqual({});
  });
});

describe("paletteCssVars", () => {
  it("names the same variables the generated @theme block declares", () => {
    expect(paletteCssVars({ [COLOR_SETTING_KEYS["brand-3"]]: "#010203" })).toEqual([
      ["--color-brand-3", "#010203"],
    ]);
  });

  // Writing all five would freeze the palette at this bundle's build-time
  // values, so a later token change would never reach a store that had
  // overridden nothing.
  it("emits nothing when there is no override", () => {
    expect(paletteCssVars({ store_name: "Corner Cafe" })).toEqual([]);
  });
});

describe("the key table", () => {
  it("covers every palette entry, so no colour is unthemeable", () => {
    expect(Object.keys(COLOR_SETTING_KEYS).sort()).toEqual(Object.keys(PALETTE).sort());
  });

  it("uses snake_case keys like every other setting", () => {
    for (const key of COLOR_SETTING_KEY_LIST) {
      expect(key, key).toMatch(/^[a-z0-9_]+$/);
    }
  });
});
