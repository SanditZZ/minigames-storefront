import { describe, expect, it } from "vitest";
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
    expect(copy.note).toMatch(/counter/i);
  });

  it("stands the code down once it is redeemed or expired", () => {
    expect(claimCopy("redeemed").redeemable).toBe(false);
    expect(claimCopy("expired").redeemable).toBe(false);
  });

  it("gives each state a distinct label and note", () => {
    const states = (["issued", "redeemed", "expired"] as const).map(claimCopy);
    expect(new Set(states.map((s) => s.label)).size).toBe(3);
    expect(new Set(states.map((s) => s.note)).size).toBe(3);
    for (const s of states) {
      expect(s.label).not.toBe("");
      expect(s.note).not.toBe("");
    }
  });

  // Defensive: an unrecognised status must read as collectable rather than
  // silently denying a prize the player genuinely won. A wrong "come back
  // later" is recoverable at the counter; a wrong "you won nothing" is not.
  it("falls back to collectable for an unknown status", () => {
    expect(claimCopy("something-new" as never).redeemable).toBe(true);
  });
});
