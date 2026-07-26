import { describe, expect, it } from "vitest";
import { gfMul, generatorPoly, remainder } from "./gf";

describe("GF(256) arithmetic", () => {
  it("multiplies like a field: commutative, 1 is identity, 0 absorbs", () => {
    expect(gfMul(0, 123)).toBe(0);
    expect(gfMul(123, 0)).toBe(0);
    expect(gfMul(1, 123)).toBe(123);
    expect(gfMul(123, 1)).toBe(123);
    expect(gfMul(87, 131)).toBe(gfMul(131, 87));
    // Every product stays inside the field — the whole point of reducing modulo
    // the primitive polynomial.
    for (let a = 1; a < 256; a += 37) {
      for (let b = 1; b < 256; b += 29) {
        const p = gfMul(a, b);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThan(256);
      }
    }
  });

  it("builds a generator polynomial of the requested degree", () => {
    for (const ec of [7, 10, 13, 17]) {
      const poly = generatorPoly(ec);
      expect(poly).toHaveLength(ec + 1);
      expect(poly[0]).toBe(1); // monic
    }
  });

  it("produces the published error-correction codewords for a known message", () => {
    // The worked example from Thonky's QR tutorial: "HELLO WORLD" as version 1,
    // level Q — 13 data codewords in, 13 error-correction codewords out.
    //
    // It is here rather than in encode.test.ts on purpose: it pins the field
    // arithmetic against a source OUTSIDE this repo, independently of anything
    // this package decided about versions, masks or module layout.
    const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236];
    expect(remainder(data, 13)).toEqual([168, 72, 22, 82, 217, 54, 156, 0, 46, 15, 180, 122, 16]);
  });

  it("leaves the caller's data alone", () => {
    const data = [32, 91, 11];
    const copy = [...data];
    remainder(data, 17);
    expect(data).toEqual(copy);
  });
});
