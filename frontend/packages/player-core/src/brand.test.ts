import { describe, expect, it } from "vitest";
import {
  DEFAULT_IDENTITY,
  STORE_LOGO_KEY,
  STORE_NAME_KEY,
  STORE_TAGLINE_KEY,
  storeIdentity,
} from "./brand";

describe("storeIdentity", () => {
  it("uses the admin-configured name and tagline", () => {
    expect(
      storeIdentity({
        [STORE_NAME_KEY]: "Corner Cafe",
        [STORE_TAGLINE_KEY]: "Coffee and prizes",
      }),
    ).toEqual({ name: "Corner Cafe", tagline: "Coffee and prizes", logoUrl: "" });
  });

  it("carries the logo URL when one is set", () => {
    expect(storeIdentity({ [STORE_LOGO_KEY]: "http://api/uploads/abc.png" }).logoUrl).toBe(
      "http://api/uploads/abc.png",
    );
  });

  // No stock logo ships: an unconfigured storefront shows its wordmark rather
  // than somebody else's mark.
  it("has no logo by default", () => {
    expect(DEFAULT_IDENTITY.logoUrl).toBe("");
    expect(storeIdentity({}).logoUrl).toBe("");
  });

  // The reason this is per-field: an operator who names the shop but never
  // touches the tagline must not lose the name to the fallback pair.
  it("falls back per field, not all-or-nothing", () => {
    expect(storeIdentity({ [STORE_NAME_KEY]: "Corner Cafe" })).toEqual({
      name: "Corner Cafe",
      tagline: DEFAULT_IDENTITY.tagline,
      logoUrl: DEFAULT_IDENTITY.logoUrl,
    });
  });

  it("treats a blank or whitespace-only value as unset", () => {
    expect(
      storeIdentity({
        [STORE_NAME_KEY]: "   ",
        [STORE_TAGLINE_KEY]: "",
        [STORE_LOGO_KEY]: "  ",
      }),
    ).toEqual(DEFAULT_IDENTITY);
  });

  it("trims surrounding whitespace from a real value", () => {
    expect(storeIdentity({ [STORE_NAME_KEY]: "  Corner Cafe \n" }).name).toBe(
      "Corner Cafe",
    );
  });

  // The unreachable-backend case: the header still renders a store, so a kiosk
  // with a dropped network looks idle rather than broken.
  it("returns the built-in identity when settings are missing", () => {
    expect(storeIdentity(null)).toEqual(DEFAULT_IDENTITY);
    expect(storeIdentity(undefined)).toEqual(DEFAULT_IDENTITY);
    expect(storeIdentity({})).toEqual(DEFAULT_IDENTITY);
  });

  // Unrelated public keys will appear here as the allowlist grows (colours,
  // logo). Reading by key rather than by shape keeps that from mattering.
  it("ignores keys it does not know about", () => {
    expect(storeIdentity({ color_brand: "#ff0000" })).toEqual(DEFAULT_IDENTITY);
  });
});
