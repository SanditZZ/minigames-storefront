import { describe, expect, it } from "vitest";
import type { Setting } from "@minigames/api-client";
import { COLOR_SETTING_KEYS } from "@minigames/tokens";
import {
  brandingChanges,
  brandingDirty,
  draftPalette,
  invalidBrandingColors,
  readBranding,
  type BrandingDraft,
} from "./branding";

const row = (key: string, value: string): Setting => ({
  key,
  value,
  type: "string",
  description: "",
  updatedAt: "2026-07-26T00:00:00Z",
});

const blank: BrandingDraft = {
  name: "",
  tagline: "",
  logoUrl: "",
  bannerUrl: "",
  brand: "",
  "brand-2": "",
  "brand-3": "",
  "brand-4": "",
  ink: "",
};

describe("readBranding", () => {
  it("reads identity and colours out of the settings rows", () => {
    const saved = readBranding([
      row("store_name", "Corner Cafe"),
      row(COLOR_SETTING_KEYS.brand, "#112233"),
    ]);
    expect(saved.name).toBe("Corner Cafe");
    expect(saved.brand).toBe("#112233");
    expect(saved.ink).toBe("");
  });

  it("reports every field as unset for a store that has customised nothing", () => {
    expect(readBranding([])).toEqual(blank);
  });
});

describe("brandingChanges", () => {
  it("writes only the field that changed", () => {
    const saved = { ...blank, name: "Corner Cafe", tagline: "Old" };
    expect(brandingChanges({ ...saved, tagline: "New" }, saved)).toEqual([
      { key: "store_tagline", value: "New", previous: "Old", kind: "string" },
    ]);
  });

  it("normalises a colour to lowercase so #FFF and #fff are one override", () => {
    expect(brandingChanges({ ...blank, brand: " #FF9A86 " }, blank)).toEqual([
      { key: COLOR_SETTING_KEYS.brand, value: "#ff9a86", previous: "", kind: "color" },
    ]);
  });

  // The distinction the whole module exists for. A cleared colour is a DELETE
  // (kind "color", empty value); a cleared tagline is a write of "".
  it("marks a cleared colour as an empty colour change, not a stored blank", () => {
    const saved = { ...blank, brand: "#ff9a86", tagline: "Old" };
    const out = brandingChanges({ ...saved, brand: "", tagline: "" }, saved);

    expect(out).toContainEqual({
      key: COLOR_SETTING_KEYS.brand,
      value: "",
      previous: "#ff9a86",
      kind: "color",
    });
    expect(out).toContainEqual({
      key: "store_tagline",
      value: "",
      previous: "Old",
      kind: "string",
    });
  });

  // Unlike a colour, a cleared image is a WRITE of "": there is no built-in
  // logo or banner to fall back to, so "" is the real value meaning "none".
  it("stores a cleared logo rather than deleting the row", () => {
    const saved = { ...blank, logoUrl: "http://api/uploads/abc.png" };
    expect(brandingChanges({ ...saved, logoUrl: "" }, saved)).toEqual([
      { key: "store_logo_url", value: "", previous: "http://api/uploads/abc.png", kind: "string" },
    ]);
  });

  // The two images are separate settings, and this is the test that would fail
  // if the table paired either field with the other's key — a swap that a form
  // driving both through the same code path makes easy and silent.
  it("writes the logo and the banner to their own keys", () => {
    const saved = { ...blank, logoUrl: "http://api/mark.png", bannerUrl: "http://api/old.jpg" };
    expect(
      brandingChanges({ ...saved, bannerUrl: " http://api/cover.jpg " }, saved),
    ).toEqual([
      {
        key: "store_banner_url",
        value: "http://api/cover.jpg",
        previous: "http://api/old.jpg",
        kind: "string",
      },
    ]);
  });

  it("is empty when nothing changed", () => {
    const saved = { ...blank, name: "Corner Cafe" };
    expect(brandingChanges(saved, saved)).toEqual([]);
    expect(brandingDirty(saved, saved)).toBe(false);
  });
});

describe("invalidBrandingColors", () => {
  it("flags a value that is neither empty nor a colour", () => {
    expect(invalidBrandingColors({ ...blank, brand: "coral", ink: "#123456" })).toEqual(["brand"]);
  });

  // Empty is how an override is cleared — flagging it would make "use the
  // default" look like a typo.
  it("does not flag an empty field", () => {
    expect(invalidBrandingColors(blank)).toEqual([]);
  });
});

describe("draftPalette", () => {
  it("previews with the app's own precedence rule, not the raw draft", () => {
    const palette = draftPalette({ ...blank, brand: "#123456", ink: "#ff" });

    expect(palette.brand).toBe("#123456");
    // Half-typed and blank both mean "the token stands" — the same answer the
    // player's renderer gives, which is the point of routing through it.
    expect(palette.ink).toBe("#4a2b20");
    expect(palette["brand-4"]).toBe("#fff0be");
  });
});
