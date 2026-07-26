import { describe, expect, it } from "vitest";
import {
  describeStored,
  durationSpecFor,
  formatDuration,
  fromBase,
  parseDuration,
  toBase,
  unitLabel,
  DURATION_SETTINGS,
  type DurationSpec,
} from "./duration";

const CLAIM: DurationSpec = DURATION_SETTINGS.claim_ttl_hours;
const SESSION: DurationSpec = DURATION_SETTINGS.session_ttl_seconds;

describe("durationSpecFor", () => {
  it("knows the settings the backend seeds", () => {
    expect(durationSpecFor("claim_ttl_hours")).toEqual({ base: "hours", units: ["hours", "days"] });
    expect(durationSpecFor("session_ttl_seconds")?.base).toBe("seconds");
  });

  // Everything else keeps the plain integer box it has always had.
  it("returns null for anything that is not a duration", () => {
    expect(durationSpecFor("high_score_limit")).toBeNull();
    expect(durationSpecFor("max_taps_per_second")).toBeNull();
    expect(durationSpecFor("")).toBeNull();
  });

  // A spec whose base is not among its own units could never round-trip.
  it("offers its own base unit", () => {
    for (const spec of Object.values(DURATION_SETTINGS)) {
      expect(spec.units).toContain(spec.base);
    }
  });
});

describe("fromBase", () => {
  // The seeded value, and the reason this feature exists: 168 is a week, and
  // nobody should have to do that division.
  it("shows the coarsest unit that divides evenly", () => {
    expect(fromBase(168, CLAIM)).toEqual({ amount: 7, unit: "days" });
    expect(fromBase(24, CLAIM)).toEqual({ amount: 1, unit: "days" });
    expect(fromBase(120, SESSION)).toEqual({ amount: 2, unit: "minutes" });
  });

  // The case that decided the design: a remainder keeps the finer unit rather
  // than becoming a fraction the operator never typed.
  it("keeps the base unit when a coarser one would leave a remainder", () => {
    expect(fromBase(36, CLAIM)).toEqual({ amount: 36, unit: "hours" });
    expect(fromBase(1, CLAIM)).toEqual({ amount: 1, unit: "hours" });
    expect(fromBase(90, SESSION)).toEqual({ amount: 90, unit: "seconds" });
  });

  // Zero is not a length here — for claim_ttl_hours it means "never expires" —
  // so it is not dressed in a coarser unit that implies one was chosen.
  it("leaves zero in the base unit", () => {
    expect(fromBase(0, CLAIM)).toEqual({ amount: 0, unit: "hours" });
    expect(fromBase(0, SESSION)).toEqual({ amount: 0, unit: "seconds" });
  });

  it("survives a value that is not a number", () => {
    expect(fromBase(NaN, CLAIM)).toEqual({ amount: 0, unit: "hours" });
  });
});

describe("toBase", () => {
  it("converts back into the unit the setting stores", () => {
    expect(toBase({ amount: 7, unit: "days" }, CLAIM)).toBe(168);
    expect(toBase({ amount: 36, unit: "hours" }, CLAIM)).toBe(36);
    expect(toBase({ amount: 2, unit: "minutes" }, SESSION)).toBe(120);
    expect(toBase({ amount: 0, unit: "days" }, CLAIM)).toBe(0);
  });

  // The round trip is what protects an operator who opens the panel, changes
  // nothing, and saves: the number written back must be the number that was
  // there.
  it("round-trips every value a setting can hold", () => {
    for (const stored of [0, 1, 2, 5, 23, 24, 36, 47, 48, 168, 169, 720]) {
      expect(toBase(fromBase(stored, CLAIM), CLAIM), `claim ${stored}`).toBe(stored);
    }
    for (const stored of [0, 1, 30, 59, 60, 90, 120, 3600]) {
      expect(toBase(fromBase(stored, SESSION), SESSION), `session ${stored}`).toBe(stored);
    }
  });
});

describe("parseDuration", () => {
  it("reads a stored integer", () => {
    expect(parseDuration("168", CLAIM)).toEqual({ amount: 7, unit: "days" });
    expect(parseDuration("  36  ", CLAIM)).toEqual({ amount: 36, unit: "hours" });
  });

  // Null is the signal to fall back to the raw text box. A settings table is
  // hand-editable, and a malformed value should be visible and fixable rather
  // than silently coerced into something the operator never typed.
  it("refuses anything that is not a whole non-negative number", () => {
    expect(parseDuration("1.5", CLAIM)).toBeNull();
    expect(parseDuration("abc", CLAIM)).toBeNull();
    expect(parseDuration("", CLAIM)).toBeNull();
    expect(parseDuration("-4", CLAIM)).toBeNull();
    expect(parseDuration("9007199254740993", CLAIM)).toBeNull();
  });
});

describe("formatDuration and describeStored", () => {
  it("serialises to the string the setting stores", () => {
    expect(formatDuration({ amount: 7, unit: "days" }, CLAIM)).toBe("168");
    expect(formatDuration({ amount: 2, unit: "minutes" }, SESSION)).toBe("120");
  });

  // The key says hours and the backend reads hours, so the panel still shows
  // the number that is actually stored — this is the control staying honest
  // about a value it converted.
  it("names the stored value in the setting's own unit", () => {
    expect(describeStored({ amount: 7, unit: "days" }, CLAIM)).toBe("168 hours");
    expect(describeStored({ amount: 1, unit: "hours" }, CLAIM)).toBe("1 hour");
    expect(describeStored({ amount: 0, unit: "hours" }, CLAIM)).toBe("0 hours");
  });
});

describe("unitLabel", () => {
  it("is singular for exactly one", () => {
    expect(unitLabel("days", 1)).toBe("day");
    expect(unitLabel("days", 7)).toBe("days");
    expect(unitLabel("days", 0)).toBe("days");
    expect(unitLabel("minutes", 1)).toBe("minute");
  });
});
