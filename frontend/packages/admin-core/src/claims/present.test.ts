import { describe, expect, it } from "vitest";
import { claimStatusLabel, claimStatusTone, reasonFrom, redeemErrorMessage } from "./present";

describe("claim status presentation", () => {
  it("labels each state distinctly", () => {
    const labels = (["issued", "redeemed", "expired"] as const).map(claimStatusLabel);
    expect(new Set(labels).size).toBe(3);
  });

  // Only an outstanding claim is a prize still owed to someone.
  it("emphasises only outstanding claims", () => {
    expect(claimStatusTone("issued")).toBe("on");
    expect(claimStatusTone("redeemed")).toBe("off");
    expect(claimStatusTone("expired")).toBe("off");
  });
});

describe("reasonFrom", () => {
  // The backend wraps refusals as "<sentinel>: <reason>". An admin should read
  // the reason to a customer, not a Go error name.
  it("keeps the human half of a wrapped error", () => {
    expect(reasonFrom("claim not redeemable: this claim has already been redeemed")).toBe(
      "this claim has already been redeemed",
    );
    expect(reasonFrom("claim not redeemable: this claim has expired")).toBe("this claim has expired");
  });

  // A reworded backend must degrade to clumsy, never to blank.
  it("passes an unwrapped message through whole", () => {
    expect(reasonFrom("something went sideways")).toBe("something went sideways");
  });

  it("falls back to the whole message when the reason half is empty", () => {
    expect(reasonFrom("claim not redeemable: ")).toBe("claim not redeemable: ");
  });

  it("survives an empty message", () => {
    expect(reasonFrom("")).toBe("");
  });
});

describe("redeemErrorMessage", () => {
  // Each status is a different next action, so each gets its own sentence.
  it("tells a mistyped code apart from a spent one", () => {
    const missing = redeemErrorMessage(404, "claim not found");
    const spent = redeemErrorMessage(409, "claim not redeemable: this claim has already been redeemed");
    expect(missing).toMatch(/check the characters/i);
    expect(spent).toMatch(/already been redeemed/i);
    expect(missing).not.toBe(spent);
  });

  it("names an expired session as the admin's own problem", () => {
    expect(redeemErrorMessage(401, "unauthorized")).toMatch(/sign in again/i);
  });

  it("never returns an empty string, whatever the server said", () => {
    for (const status of [400, 404, 409, 401, 500]) {
      expect(redeemErrorMessage(status, "")).not.toBe("");
    }
  });
});
