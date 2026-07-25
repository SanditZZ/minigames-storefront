import { describe, expect, it } from "vitest";
import type { Prize } from "@minigames/api-client";
import { mergePrizes, orderPrizes, type ShowcasePrize } from "./merge";

function prize(name: string, over: Partial<Prize> = {}): Prize {
  return {
    name,
    description: "",
    imageUrl: "",
    minScore: 0,
    soldOut: false,
    ...over,
  };
}

describe("mergePrizes", () => {
  it("keeps a single game's prizes in order", () => {
    const got = mergePrizes([[prize("Coupon"), prize("Coffee"), prize("Tote")]]);
    expect(got.map((p) => p.name)).toEqual(["Coupon", "Coffee", "Tote"]);
  });

  // The same prize offered by two games is one prize to a customer who has not
  // picked a game yet.
  it("de-duplicates the same prize across games", () => {
    const got = mergePrizes([
      [prize("Coupon"), prize("Coffee")],
      [prize("Coupon"), prize("Tote")],
    ]);
    expect(got.map((p) => p.name)).toEqual(["Coupon", "Coffee", "Tote"]);
  });

  // Greying out a prize a customer could still win talks them out of playing.
  it("is sold out only when unavailable in every game", () => {
    const got = mergePrizes([
      [prize("Coffee", { soldOut: true })],
      [prize("Coffee", { soldOut: false })],
    ]);
    expect(got[0].soldOut).toBe(false);
  });

  it("is sold out when it has run out everywhere", () => {
    const got = mergePrizes([
      [prize("Coffee", { soldOut: true })],
      [prize("Coffee", { soldOut: true })],
    ]);
    expect(got[0].soldOut).toBe(true);
  });

  it("fills in details from whichever copy has them", () => {
    const got = mergePrizes([
      [prize("Coffee")],
      [prize("Coffee", { description: "A free flat white", imageUrl: "/coffee.png" })],
    ]);
    expect(got[0].description).toBe("A free flat white");
    expect(got[0].imageUrl).toBe("/coffee.png");
  });

  it("handles no games and empty lists", () => {
    expect(mergePrizes([])).toEqual([]);
    expect(mergePrizes([[], []])).toEqual([]);
  });

  // Thresholds are per-game and meaningless before a game is chosen, so they
  // must not survive the merge.
  it("drops per-game thresholds", () => {
    const got = mergePrizes([[prize("Coffee", { minScore: 40 })]]);
    expect(got[0]).not.toHaveProperty("minScore");
  });
});

describe("orderPrizes", () => {
  const show = (name: string, soldOut = false): ShowcasePrize => ({
    name,
    description: "",
    imageUrl: "",
    soldOut,
  });

  it("puts winnable prizes before sold-out ones", () => {
    const got = orderPrizes([show("Gone", true), show("Coupon"), show("Also gone", true), show("Tote")]);
    expect(got.map((p) => p.name)).toEqual(["Coupon", "Tote", "Gone", "Also gone"]);
  });

  it("preserves the backend's easiest-first order within each group", () => {
    const got = orderPrizes([show("Coupon"), show("Coffee"), show("Tote")]);
    expect(got.map((p) => p.name)).toEqual(["Coupon", "Coffee", "Tote"]);
  });

  it("does not mutate its input", () => {
    const input = [show("Gone", true), show("Coupon")];
    orderPrizes(input);
    expect(input.map((p) => p.name)).toEqual(["Gone", "Coupon"]);
  });
});
