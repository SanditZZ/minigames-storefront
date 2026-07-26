import { describe, expect, it } from "vitest";
import type { Award } from "@minigames/api-client";
import { UNLIMITED_STOCK } from "@minigames/api-client";
import {
  appliesToGame,
  filterAwards,
  matchesQuery,
  matchesStatus,
  matchesStock,
  sortAwards,
  visibleAwards,
  type AwardQuery,
} from "./filter";

function award(name: string, over: Partial<Award> = {}): Award {
  return {
    id: name,
    name,
    description: "",
    nameTh: "",
    descriptionTh: "",
    imageUrl: "",
    gameSlug: "tap-fast",
    minScore: 0,
    stock: UNLIMITED_STOCK,
    active: true,
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

const ALL: AwardQuery = { gameSlug: "", status: "all", stock: "all", query: "" };
const names = (list: Award[]) => list.map((a) => a.name);

describe("appliesToGame", () => {
  it("matches everything when no game is selected", () => {
    expect(appliesToGame(award("A", { gameSlug: "tap-fast" }), "")).toBe(true);
    expect(appliesToGame(award("B", { gameSlug: "reaction-timer" }), "")).toBe(true);
  });

  it("matches the selected game", () => {
    expect(appliesToGame(award("A", { gameSlug: "tap-fast" }), "tap-fast")).toBe(true);
    expect(appliesToGame(award("A", { gameSlug: "reaction-timer" }), "tap-fast")).toBe(false);
  });

  // The backend awards a wildcard for every game, so hiding it behind a game
  // filter would tell an admin a prize is not offered when it is.
  it("includes wildcard awards under every game", () => {
    expect(appliesToGame(award("Any", { gameSlug: "" }), "tap-fast")).toBe(true);
    expect(appliesToGame(award("Any", { gameSlug: "" }), "reaction-timer")).toBe(true);
  });
});

describe("matchesStatus", () => {
  it("filters by active flag", () => {
    expect(matchesStatus(award("A", { active: true }), "active")).toBe(true);
    expect(matchesStatus(award("A", { active: true }), "inactive")).toBe(false);
    expect(matchesStatus(award("A", { active: false }), "inactive")).toBe(true);
    expect(matchesStatus(award("A", { active: false }), "all")).toBe(true);
  });
});

describe("matchesStock", () => {
  const endless = award("E", { stock: UNLIMITED_STOCK });
  const some = award("S", { stock: 7 });
  const gone = award("G", { stock: 0 });

  it("treats unlimited as in stock", () => {
    expect(matchesStock(endless, "in")).toBe(true);
    expect(matchesStock(some, "in")).toBe(true);
    expect(matchesStock(gone, "in")).toBe(false);
  });

  it("isolates sold out and unlimited", () => {
    expect(matchesStock(gone, "out")).toBe(true);
    expect(matchesStock(some, "out")).toBe(false);
    expect(matchesStock(endless, "unlimited")).toBe(true);
    expect(matchesStock(some, "unlimited")).toBe(false);
  });

  it("matches everything on all", () => {
    for (const a of [endless, some, gone]) expect(matchesStock(a, "all")).toBe(true);
  });
});

describe("matchesQuery", () => {
  it("is a case-insensitive substring match on the name", () => {
    const a = award("Free Coffee");
    expect(matchesQuery(a, "coffee")).toBe(true);
    expect(matchesQuery(a, "COFF")).toBe(true);
    expect(matchesQuery(a, "tote")).toBe(false);
  });

  // Otherwise a prize named in Thai is unfindable by the only name the staff
  // who named it think of it as.
  it("also matches the Thai name", () => {
    const a = award("Free Coffee", { nameTh: "กาแฟฟรี" });
    expect(matchesQuery(a, "กาแฟ")).toBe(true);
    // Both names stay searchable — translating a prize must not cost the
    // English lookup an operator was already using.
    expect(matchesQuery(a, "coffee")).toBe(true);
    expect(matchesQuery(a, "ถุงผ้า")).toBe(false);
  });

  it("does not match an untranslated award on an empty Thai name", () => {
    // "" is a substring of every string, so a naive includes() on nameTh would
    // make every untranslated prize match every query.
    const a = award("Free Coffee");
    expect(matchesQuery(a, "tote")).toBe(false);
  });

  it("matches everything when the query is blank", () => {
    expect(matchesQuery(award("Free Coffee"), "")).toBe(true);
    expect(matchesQuery(award("Free Coffee"), "   ")).toBe(true);
  });
});

describe("filterAwards", () => {
  const list = [
    award("Coupon", { gameSlug: "", minScore: 20, stock: UNLIMITED_STOCK }),
    award("Coffee", { gameSlug: "tap-fast", minScore: 40, stock: 100 }),
    award("Tote", { gameSlug: "tap-fast", minScore: 60, stock: 0, active: false }),
    award("Sticker", { gameSlug: "reaction-timer", minScore: 400, stock: 5 }),
  ];

  it("returns everything when unfiltered", () => {
    expect(names(filterAwards(list, ALL))).toEqual(["Coupon", "Coffee", "Tote", "Sticker"]);
  });

  it("combines every filter", () => {
    const got = filterAwards(list, { gameSlug: "tap-fast", status: "active", stock: "in", query: "" });
    // Coupon is a wildcard and in stock; Coffee matches; Tote is inactive and
    // sold out; Sticker belongs to another game.
    expect(names(got)).toEqual(["Coupon", "Coffee"]);
  });

  it("preserves input order", () => {
    expect(names(filterAwards(list, { ...ALL, stock: "in" }))).toEqual(["Coupon", "Coffee", "Sticker"]);
  });

  it("can return nothing", () => {
    expect(filterAwards(list, { ...ALL, query: "nothing matches this" })).toEqual([]);
  });
});

describe("sortAwards", () => {
  const list = [
    award("Beta", { sortOrder: 2, minScore: 50, stock: 5 }),
    award("Alpha", { sortOrder: 3, minScore: 10, stock: UNLIMITED_STOCK }),
    award("Gamma", { sortOrder: 1, minScore: 30, stock: 0 }),
  ];

  it("defaults to the admin-configured order", () => {
    expect(names(sortAwards(list, "order"))).toEqual(["Gamma", "Beta", "Alpha"]);
  });

  it("sorts by name and threshold", () => {
    expect(names(sortAwards(list, "name"))).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(names(sortAwards(list, "threshold"))).toEqual(["Alpha", "Gamma", "Beta"]);
  });

  // -1 on the wire would otherwise sort an endless prize below a sold-out one.
  it("ranks unlimited stock highest, not lowest", () => {
    expect(names(sortAwards(list, "stock"))).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("breaks ties by name so the order never depends on fetch order", () => {
    const tied = [award("Zed", { sortOrder: 1 }), award("Ann", { sortOrder: 1 })];
    expect(names(sortAwards(tied, "order"))).toEqual(["Ann", "Zed"]);
  });

  it("does not mutate its input", () => {
    const input = [award("B", { sortOrder: 2 }), award("A", { sortOrder: 1 })];
    sortAwards(input, "order");
    expect(names(input)).toEqual(["B", "A"]);
  });
});

describe("visibleAwards", () => {
  it("filters then sorts", () => {
    const list = [
      award("Tote", { sortOrder: 3, active: true }),
      award("Hidden", { sortOrder: 1, active: false }),
      award("Coffee", { sortOrder: 2, active: true }),
    ];
    expect(names(visibleAwards(list, { ...ALL, status: "active" }, "order"))).toEqual(["Coffee", "Tote"]);
  });
});
