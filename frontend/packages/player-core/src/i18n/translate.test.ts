import { describe, expect, it } from "vitest";
import { en, type MessageKey } from "./en";
import { DEFAULT_LOCALE, LOCALES } from "./locales";
import { format, parseLang, parseLocale, pickLocale, translator } from "./translate";
import { th } from "./th";

const KEYS = Object.keys(en) as MessageKey[];

describe("the dictionaries", () => {
  // The types already make a missing key a compile error. This asserts the
  // other half, which they cannot: that no translation was left as a copy of
  // the English, or as an empty string that renders as a blank line.
  it("translates every key into every locale", () => {
    for (const key of KEYS) {
      expect(th[key], key).toBeTruthy();
    }
  });

  it("leaves nothing in English in the Thai dictionary", () => {
    // "Guest" is the one deliberate exception: it is the display name written
    // to the scores table, not chrome, so it has to read the same to everyone
    // looking at the leaderboard. See the note on the key in ./en.
    const untranslated = KEYS.filter((key) => th[key] === en[key] && key !== "player.guest");
    expect(untranslated).toEqual([]);
  });

  // Placeholders are the part a translator is most likely to drop, and a
  // dropped one is silent: the sentence still reads, just without the score in
  // it. A mismatch fails here instead.
  it("keeps the same placeholders in every locale", () => {
    const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of KEYS) {
      expect(placeholders(th[key]), key).toEqual(placeholders(en[key]));
    }
  });
});

describe("format", () => {
  it("fills every placeholder", () => {
    expect(format("Rank #{rank}", { rank: 3 })).toBe("Rank #3");
    expect(format("{a} and {b}", { a: "x", b: "y" })).toBe("x and y");
  });

  it("repeats a value used twice", () => {
    expect(format("{n}-{n}", { n: 7 })).toBe("7-7");
  });

  // Leaving the placeholder visible is the point: a missing value should be
  // obvious in a screenshot, not a hole in the middle of a sentence.
  it("leaves a placeholder with no value in place", () => {
    expect(format("Hello {name}", {})).toBe("Hello {name}");
    expect(format("Hello {name}")).toBe("Hello {name}");
  });
});

describe("translator", () => {
  it("returns the locale's own copy", () => {
    expect(translator("en")("result.playAgain")).toBe(en["result.playAgain"]);
    expect(translator("th")("result.playAgain")).toBe(th["result.playAgain"]);
  });

  it("interpolates", () => {
    expect(translator("en")("result.rank", { rank: 4 })).toBe("Rank #4");
    expect(translator("th")("result.rank", { rank: 4 })).toContain("4");
  });

  it("falls back to English for a locale it does not have", () => {
    expect(translator("de" as never)("result.playAgain")).toBe(en["result.playAgain"]);
  });
});

describe("parseLocale", () => {
  it("accepts a bare tag in any case", () => {
    expect(parseLocale("th")).toBe("th");
    expect(parseLocale("TH")).toBe("th");
    expect(parseLocale("  en  ")).toBe("en");
  });

  // One Thai translation, not one per region: th-TH and th are the same thing.
  it("ignores the region subtag", () => {
    expect(parseLocale("th-TH")).toBe("th");
    expect(parseLocale("en_GB")).toBe("en");
  });

  // Null rather than the default, so "unrecognised" can fall through to the
  // device while "explicitly English" pins.
  it("returns null for anything it does not speak", () => {
    expect(parseLocale("de")).toBeNull();
    expect(parseLocale("")).toBeNull();
    expect(parseLocale(null)).toBeNull();
    expect(parseLocale(undefined)).toBeNull();
  });
});

describe("parseLang", () => {
  it("reads the pin out of a query string", () => {
    expect(parseLang("?lang=th")).toBe("th");
    expect(parseLang("?name=Po&lang=en")).toBe("en");
  });

  it("treats an absent or unknown pin as unpinned", () => {
    expect(parseLang("?name=Po")).toBeNull();
    expect(parseLang("?lang=de")).toBeNull();
    expect(parseLang("")).toBeNull();
  });
});

describe("pickLocale", () => {
  // The case the whole feature exists for: a till-side phone running an English
  // OS, pinned to Thai for the customers standing in front of it.
  it("lets an explicit pin beat the device", () => {
    expect(pickLocale("th", ["en-GB", "en"])).toBe("th");
    expect(pickLocale("en", ["th-TH"])).toBe("en");
  });

  it("follows the device when nothing is pinned", () => {
    expect(pickLocale(null, ["th-TH", "en-US"])).toBe("th");
    expect(pickLocale(null, ["en-US", "th"])).toBe("en");
  });

  it("skips device languages it does not speak", () => {
    expect(pickLocale(null, ["de-DE", "fr", "th"])).toBe("th");
  });

  it("falls back to the default when nothing matches", () => {
    expect(pickLocale(null, ["de", "fr"])).toBe(DEFAULT_LOCALE);
    expect(pickLocale(null, [])).toBe(DEFAULT_LOCALE);
    expect(pickLocale(undefined)).toBe(DEFAULT_LOCALE);
  });

  it("can return every locale it offers", () => {
    for (const locale of LOCALES) {
      expect(pickLocale(locale)).toBe(locale);
    }
  });
});
