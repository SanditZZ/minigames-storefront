import { describe, expect, it } from "vitest";
import { decodeSettings, encodeSettings } from "./cache";

describe("settings cache codec", () => {
  it("round-trips what the endpoint served", () => {
    const settings = { store_name: "Tailnet Coffee", color_brand: "#00b3a4" };
    expect(decodeSettings(encodeSettings(settings))).toEqual(settings);
  });

  it("keeps an empty map, because 'nothing configured' is an answer", () => {
    // Distinct from null on purpose: it is the case where the built-in defaults
    // are correct rather than merely all the app has.
    expect(decodeSettings(encodeSettings({}))).toEqual({});
  });

  it("has no opinion when nothing was ever stored", () => {
    expect(decodeSettings(null)).toBeNull();
    expect(decodeSettings(undefined)).toBeNull();
    expect(decodeSettings("")).toBeNull();
  });

  it("refuses a blob that is not a flat map", () => {
    // A tab killed mid-write, an older version of the app, or a person's own
    // console — the copy is untrusted input, so each of these has to be nothing
    // rather than something the palette or an <img src> then renders.
    expect(decodeSettings("{store_name:")).toBeNull();
    expect(decodeSettings("[]")).toBeNull();
    expect(decodeSettings("null")).toBeNull();
    expect(decodeSettings('"a string"')).toBeNull();
    expect(decodeSettings("42")).toBeNull();
  });

  it("drops non-string values and keeps the rest", () => {
    expect(decodeSettings('{"store_name":"Fun Store","claim_ttl_hours":48,"x":null}')).toEqual({
      store_name: "Fun Store",
    });
  });
});
