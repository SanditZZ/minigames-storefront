import { describe, expect, it } from "vitest";
import { ALPHANUMERIC, MAX_LENGTH, canEncode, encode, penalty, svgExtent, toSvgPath } from "./encode";

/** A matrix as one string per row, "1" for a dark module — readable in a diff. */
function rows(text: string): string[] {
  const qr = encode(text);
  if (!qr) throw new Error(`refused to encode ${text}`);
  return qr.modules.map((row) => row.map((dark) => (dark ? "1" : "0")).join(""));
}

describe("capacity", () => {
  // Not a preference — it is what version 1 at level H leaves after the mode and
  // length fields. Asserted so that changing either constant fails loudly here
  // rather than silently refusing a code somewhere in the UI.
  it("holds ten alphanumeric characters", () => {
    expect(MAX_LENGTH).toBe(10);
  });

  it("accepts a claim code in any case, and the grouped form", () => {
    expect(canEncode("ABCD2345")).toBe(true);
    expect(canEncode("abcd2345")).toBe(true);
    // The dash is in QR's alphanumeric charset, so the grouped display form is
    // encodable too — even though the player card deliberately encodes the raw
    // code, which is what the redeem endpoint receives.
    expect(canEncode("ABCD-2345")).toBe(true);
  });

  it("refuses what it cannot hold rather than truncating", () => {
    expect(canEncode("")).toBe(false);
    expect(canEncode("ABCDEFGHIJK")).toBe(false); // eleven characters
    expect(canEncode("abcd_2345")).toBe(false); // underscore is not in the charset
    expect(canEncode("กาแฟ")).toBe(false);
    // encode() mirrors canEncode by returning null, so a caller that renders the
    // code as text can simply omit the QR.
    expect(encode("")).toBeNull();
    expect(encode("ABCDEFGHIJK")).toBeNull();
    expect(encode("nope!")).toBeNull();
  });

  it("covers every character it claims to", () => {
    for (const ch of ALPHANUMERIC) {
      expect(canEncode(ch)).toBe(true);
    }
  });
});

describe("symbol structure", () => {
  it("is 21 modules square", () => {
    expect(encode("ABCD2345")?.size).toBe(21);
    expect(rows("ABCD2345")).toHaveLength(21);
    for (const row of rows("ABCD2345")) expect(row).toHaveLength(21);
  });

  // A scanner locates the symbol by these three patterns before it reads a
  // single data module. If they are wrong, nothing else here matters.
  it("carries a finder pattern in three corners, with separators", () => {
    const m = rows("ABCD2345");
    const finder = ["1111111", "1000001", "1011101", "1011101", "1011101", "1000001", "1111111"];
    for (const [top, left] of [
      [0, 0],
      [0, 14],
      [14, 0],
    ]) {
      for (let r = 0; r < 7; r++) {
        expect(m[top + r].slice(left, left + 7)).toBe(finder[r]);
      }
    }
    // The fourth corner must NOT have one — that asymmetry is how a scanner
    // works out the symbol's rotation.
    expect(m[14].slice(14, 21)).not.toBe(finder[0]);
  });

  it("carries the timing patterns and the dark module", () => {
    const m = rows("ABCD2345");
    for (let i = 8; i < 13; i++) {
      expect(m[6][i]).toBe(i % 2 === 0 ? "1" : "0");
      expect(m[i][6]).toBe(i % 2 === 0 ? "1" : "0");
    }
    expect(m[13][8]).toBe("1"); // 4 * version + 9
  });

  it("is deterministic, and different codes differ", () => {
    expect(rows("ABCD2345")).toEqual(rows("ABCD2345"));
    expect(rows("abcd2345")).toEqual(rows("ABCD2345")); // case-folded, same symbol
    expect(rows("ZZZZ9999")).not.toEqual(rows("ABCD2345"));
  });

  /**
   * A golden symbol. The value of this test is entirely in where it came from:
   * the matrix below was decoded back to "ABCD2345" by `jsqr` — an independent
   * decoder, not this package — before being pinned here. Nothing in this repo
   * can decode a QR, so without an external check the rest of this file would
   * only prove the encoder is consistently wrong.
   *
   * The browser suite re-checks the same thing end to end against what the player
   * app actually renders (`e2e/tests/claim-qr.spec.ts`); this one catches a
   * regression in milliseconds instead of minutes.
   */
  it("matches a symbol verified by an outside decoder", () => {
    expect(rows("ABCD2345")).toEqual([
      "111111100100001111111",
      "100000100011101000001",
      "101110100100101011101",
      "101110100101001011101",
      "101110101010101011101",
      "100000100001001000001",
      "111111101010101111111",
      "000000001011000000000",
      "001100111001111010000",
      "000001011011110101110",
      "000110110101010111010",
      "101010001001111001010",
      "100011111101001011111",
      "000000001110000001011",
      "111111101010011010110",
      "100000100010111100100",
      "101110100111101010011",
      "101110101101111011010",
      "101110101001011011000",
      "100000100110100100000",
      "111111100100000110010",
    ]);
  });
});

describe("mask selection", () => {
  // The spec picks the lowest-penalty mask; the point of scoring at all is that
  // an unmasked symbol is usually far worse than the one that gets chosen.
  it("chooses a mask that scores better than a solid field", () => {
    const qr = encode("ABCD2345");
    if (!qr) throw new Error("refused");
    const solid = Array.from({ length: 21 }, () => new Array<boolean>(21).fill(false));
    expect(penalty(qr.modules)).toBeLessThan(penalty(solid));
  });

  it("scores a solid field as badly as its rules imply", () => {
    const solid = Array.from({ length: 21 }, () => new Array<boolean>(21).fill(true));
    // Every row and column is one 21-long run, every 2x2 is uniform, and the dark
    // ratio is 100% — the three rules that can fire on it, all firing.
    expect(penalty(solid)).toBeGreaterThan(1000);
  });
});

describe("svg output", () => {
  it("emits one sub-path per dark module, offset by the quiet zone", () => {
    const qr = encode("ABCD2345");
    if (!qr) throw new Error("refused");
    const dark = qr.modules.flat().filter(Boolean).length;
    const path = toSvgPath(qr);
    expect(path.match(/M/g) ?? []).toHaveLength(dark);
    // The top-left finder's first module sits at the quiet zone's inner corner.
    expect(path.startsWith("M4 4h1v1h-1z")).toBe(true);
  });

  it("reports an extent that includes the quiet zone on both sides", () => {
    const qr = encode("ABCD2345");
    if (!qr) throw new Error("refused");
    expect(svgExtent(qr)).toBe(29); // 21 + 4 + 4
    expect(svgExtent(qr, 0)).toBe(21);
    expect(toSvgPath(qr, 0).startsWith("M0 0h1v1h-1z")).toBe(true);
  });
});
