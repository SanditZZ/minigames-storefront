import { describe, expect, it } from "vitest";
import { LOCALES, translator } from "../i18n";
import { claimCopy, groupClaimCode } from "./present";

describe("groupClaimCode", () => {
  it("splits an eight-character code into two readable halves", () => {
    expect(groupClaimCode("ABCD2345")).toBe("ABCD-2345");
  });

  // The dash is display-only; the backend normalises it away, so what the
  // player reads and what the counter accepts are the same string.
  it("is purely cosmetic — the grouped form contains the original", () => {
    expect(groupClaimCode("XYZW9876").replace("-", "")).toBe("XYZW9876");
  });

  // A wrong-length code means something upstream is broken. Prettifying it
  // would hide that; returning it untouched puts it on screen where it shows.
  it("leaves anything that is not eight characters alone", () => {
    expect(groupClaimCode("ABC")).toBe("ABC");
    expect(groupClaimCode("ABCD23456789")).toBe("ABCD23456789");
    expect(groupClaimCode("")).toBe("");
  });
});

describe("claimCopy", () => {
  it("presents an issued claim as collectable", () => {
    const copy = claimCopy("issued");
    expect(copy.redeemable).toBe(true);
    // The wording is the dictionary's business; what this function decides is
    // WHICH sentence the state earns. Asserting through the translator keeps
    // the test honest about both without duplicating the copy here.
    expect(translator("en")(copy.noteKey)).toMatch(/counter/i);
  });

  it("stands the code down once it is redeemed or expired", () => {
    expect(claimCopy("redeemed").redeemable).toBe(false);
    expect(claimCopy("expired").redeemable).toBe(false);
  });

  it("gives each state a distinct label and note", () => {
    const states = (["issued", "redeemed", "expired"] as const).map(claimCopy);
    expect(new Set(states.map((s) => s.labelKey)).size).toBe(3);
    expect(new Set(states.map((s) => s.noteKey)).size).toBe(3);
  });

  // The keys have to resolve to real strings in EVERY language, or a state
  // nobody tested by hand shows a raw key like "claim.note.expired" at the
  // counter. The dictionary types make this unreachable at compile time; this
  // asserts it at runtime, which is what a future loaded-not-compiled
  // dictionary would need.
  it("names strings that exist in every locale", () => {
    for (const locale of LOCALES) {
      const t = translator(locale);
      for (const status of ["issued", "redeemed", "expired"] as const) {
        const copy = claimCopy(status);
        expect(t(copy.labelKey)).not.toBe(copy.labelKey);
        expect(t(copy.noteKey)).not.toBe(copy.noteKey);
      }
    }
  });

  // Defensive: an unrecognised status must read as collectable rather than
  // silently denying a prize the player genuinely won. A wrong "come back
  // later" is recoverable at the counter; a wrong "you won nothing" is not.
  it("falls back to collectable for an unknown status", () => {
    expect(claimCopy("something-new" as never).redeemable).toBe(true);
  });
});
