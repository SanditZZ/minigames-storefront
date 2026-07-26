import { describe, expect, it } from "vitest";
import {
  defaultIdentity,
  STORE_LOGO_KEY,
  STORE_NAME_KEY,
  STORE_TAGLINE_KEY,
  storeIdentity,
} from "./brand";
import { translator } from "./i18n";

const FALLBACK = defaultIdentity(translator("en"));

describe("storeIdentity", () => {
  it("uses the admin-configured name and tagline", () => {
    expect(
      storeIdentity(
        {
          [STORE_NAME_KEY]: "Corner Cafe",
          [STORE_TAGLINE_KEY]: "Coffee and prizes",
        },
        FALLBACK,
      ),
    ).toEqual({ name: "Corner Cafe", tagline: "Coffee and prizes", logoUrl: "" });
  });

  it("carries the logo URL when one is set", () => {
    expect(
      storeIdentity({ [STORE_LOGO_KEY]: "http://api/uploads/abc.png" }, FALLBACK).logoUrl,
    ).toBe("http://api/uploads/abc.png");
  });

  // No stock logo ships: an unconfigured storefront shows its wordmark rather
  // than somebody else's mark.
  it("has no logo by default", () => {
    expect(FALLBACK.logoUrl).toBe("");
    expect(storeIdentity({}, FALLBACK).logoUrl).toBe("");
  });

  // The reason this is per-field: an operator who names the shop but never
  // touches the tagline must not lose the name to the fallback pair.
  it("falls back per field, not all-or-nothing", () => {
    expect(storeIdentity({ [STORE_NAME_KEY]: "Corner Cafe" }, FALLBACK)).toEqual({
      name: "Corner Cafe",
      tagline: FALLBACK.tagline,
      logoUrl: FALLBACK.logoUrl,
    });
  });

  it("treats a blank or whitespace-only value as unset", () => {
    expect(
      storeIdentity(
        {
          [STORE_NAME_KEY]: "   ",
          [STORE_TAGLINE_KEY]: "",
          [STORE_LOGO_KEY]: "  ",
        },
        FALLBACK,
      ),
    ).toEqual(FALLBACK);
  });

  it("trims surrounding whitespace from a real value", () => {
    expect(storeIdentity({ [STORE_NAME_KEY]: "  Corner Cafe \n" }, FALLBACK).name).toBe(
      "Corner Cafe",
    );
  });

  // The unreachable-backend case: the header still renders a store, so a kiosk
  // with a dropped network looks idle rather than broken.
  it("returns the built-in identity when settings are missing", () => {
    expect(storeIdentity(null, FALLBACK)).toEqual(FALLBACK);
    expect(storeIdentity(undefined, FALLBACK)).toEqual(FALLBACK);
    expect(storeIdentity({}, FALLBACK)).toEqual(FALLBACK);
  });

  // Unrelated public keys will appear here as the allowlist grows (colours,
  // logo). Reading by key rather than by shape keeps that from mattering.
  it("ignores keys it does not know about", () => {
    expect(storeIdentity({ color_brand: "#ff0000" }, FALLBACK)).toEqual(FALLBACK);
  });
});

describe("defaultIdentity", () => {
  // The fallback is the app's OWN voice, so it follows the language. What an
  // operator actually typed does not — see the note at the top of brand.ts.
  it("speaks the app's language when no name has been configured", () => {
    const thai = defaultIdentity(translator("th"));
    expect(thai.name).not.toBe(FALLBACK.name);
    expect(thai.tagline).not.toBe(FALLBACK.tagline);
    expect(thai.logoUrl).toBe("");
  });

  it("does not translate a name the operator chose", () => {
    const thai = defaultIdentity(translator("th"));
    expect(storeIdentity({ [STORE_NAME_KEY]: "Corner Cafe" }, thai).name).toBe("Corner Cafe");
  });
});
