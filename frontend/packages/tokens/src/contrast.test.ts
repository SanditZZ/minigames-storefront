import { describe, expect, it } from "vitest";
import {
  CONTRAST_AA_NORMAL,
  contrastRatio,
  lowContrastPairs,
  paletteContrast,
  surfaceName,
} from "./contrast.ts";
import { resolvePalette, COLOR_SETTING_KEYS } from "./override.ts";

describe("contrastRatio", () => {
  // The two anchors of the scale. If these drift, the linearisation is wrong
  // and every threshold in the file means something else.
  it("is 21 for black on white and 1 for a colour on itself", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ff9a86", "#ff9a86")).toBeCloseTo(1, 5);
  });

  it("does not care which way round the pair is given", () => {
    expect(contrastRatio("#4a2b20", "#ffffff")).toBe(contrastRatio("#ffffff", "#4a2b20"));
  });

  it("expands three-digit hex the same way CSS does", () => {
    expect(contrastRatio("#fff", "#000")).toBe(contrastRatio("#ffffff", "#000000"));
  });

  // Null, not 1: a half-typed hex is not a legibility problem, and reporting it
  // as one would put a warning on screen while the operator is still typing.
  it("returns null when either side is not a colour", () => {
    expect(contrastRatio("#fff", "cornflowerblue")).toBeNull();
    expect(contrastRatio("", "#000")).toBeNull();
  });
});

describe("the shipped palette", () => {
  // The claim frontend/CLAUDE.md makes about the five tokens, checked rather
  // than asserted in prose. Editing palette.ts to something illegible now fails
  // here instead of shipping.
  it("passes AA on every pair the rules name", () => {
    expect(lowContrastPairs(resolvePalette(null))).toEqual([]);
  });

  it("measures ink against all four brand surfaces and white", () => {
    expect(paletteContrast(resolvePalette(null)).map((p) => p.on)).toEqual([
      "brand",
      "brand-2",
      "brand-3",
      "brand-4",
      "white",
    ]);
  });
});

describe("lowContrastPairs", () => {
  // The failure the whole check exists for: an operator saves a pale ink and
  // the app repaints itself unreadable with no other feedback.
  it("flags cream ink on the cream background", () => {
    const palette = resolvePalette({ [COLOR_SETTING_KEYS.ink]: "#fff0be" });
    const flagged = lowContrastPairs(palette);

    expect(flagged.map((p) => p.on)).toContain("brand-4");
    expect(flagged[0]?.ratio).toBeLessThan(CONTRAST_AA_NORMAL);
  });

  it("orders worst first, so one bad ink names its worst surface", () => {
    const flagged = lowContrastPairs(resolvePalette({ [COLOR_SETTING_KEYS.ink]: "#fff0be" }));
    const ratios = flagged.map((p) => p.ratio);

    expect(ratios).toEqual([...ratios].sort((a, b) => a - b));
  });

  it("says nothing about a dark brand colour, which is legible and merely off-brand", () => {
    expect(lowContrastPairs(resolvePalette({ [COLOR_SETTING_KEYS.brand]: "#ffffff" }))).toEqual([]);
  });

  it("takes a caller's threshold, so AAA can be asked for without a second table", () => {
    expect(lowContrastPairs(resolvePalette(null), 21).length).toBe(5);
  });
});

describe("surfaceName", () => {
  it("uses the palette's own name for a token and the word for white", () => {
    expect(surfaceName("brand")).toBe("Coral");
    expect(surfaceName("white")).toBe("white");
  });
});
