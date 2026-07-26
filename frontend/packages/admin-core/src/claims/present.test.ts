import { describe, expect, it } from "vitest";
import type { ClaimView } from "@minigames/api-client";
import {
  claimConfirmation,
  claimStatusLabel,
  claimStatusTone,
  reasonFrom,
  redeemErrorMessage,
  unredeemErrorMessage,
} from "./present";

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

describe("unredeemErrorMessage", () => {
  // The same status means the opposite thing in each direction, which is the
  // whole reason this is a second function and not a reuse of the first.
  it("answers a 409 with 'nothing to undo', not 'already used'", () => {
    const undo = unredeemErrorMessage(409, "claim not unredeemable: this claim has not been redeemed");
    expect(undo).toMatch(/has not been redeemed/i);
    expect(undo).not.toMatch(/already/i);
    expect(undo).not.toBe(redeemErrorMessage(409, "claim not redeemable: this claim has already been redeemed"));
  });

  it("never returns an empty string, whatever the server said", () => {
    for (const status of [400, 404, 409, 401, 500]) {
      expect(unredeemErrorMessage(status, "")).not.toBe("");
    }
  });
});

describe("claimConfirmation", () => {
  const view: ClaimView = {
    claim: {
      id: "c1",
      code: "ABCD2345",
      scoreId: "s1",
      awardId: "a1",
      awardName: "Free Coffee",
      issuedAt: "2026-07-26T10:00:00Z",
    },
    status: "issued",
  };

  // The point of confirming a scan is being able to tell "the claim I meant"
  // from "the claim that was in frame", which takes both facts.
  it("names the prize AND the code in both directions", () => {
    for (const action of ["redeem", "unredeem"] as const) {
      const { question } = claimConfirmation(action, view);
      expect(question).toContain("Free Coffee");
      expect(question).toContain("ABCD2345");
    }
  });

  it("asks opposite questions with distinct buttons", () => {
    const redeem = claimConfirmation("redeem", view);
    const undo = claimConfirmation("unredeem", { ...view, status: "redeemed" });
    expect(redeem.question).not.toBe(undo.question);
    expect(redeem.verb).not.toBe(undo.verb);
  });

  // It must not promise the prize becomes collectable again — a claim whose
  // window closed while it was marked collected comes back expired.
  it("admits the undo may land on expired", () => {
    const undo = claimConfirmation("unredeem", { ...view, status: "redeemed" });
    expect(undo.note).toMatch(/expired/i);
  });

  it("says a redemption happens only once", () => {
    expect(claimConfirmation("redeem", view).note).toMatch(/once/i);
  });
});
