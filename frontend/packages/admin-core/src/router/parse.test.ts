import { describe, expect, it } from "vitest";
import {
  clearedFilters,
  hasActiveFilters,
  hrefFor,
  isSafeSlug,
  isTab,
  parseAwardId,
  parseGameSlug,
  parseLocation,
  parseQuery,
  parseSort,
  parseStatus,
  parseStock,
  parseTab,
  pathFor,
  resolveGameSlug,
  sameLocation,
} from "./parse";
import { DEFAULT_LOCATION, DEFAULT_TAB, NEW_AWARD, TABS, type Location } from "./routes";

/** A location with everything at its default, overridden as needed. */
const at = (over: Partial<Location> = {}): Location => ({ ...DEFAULT_LOCATION, ...over });

describe("parseTab", () => {
  it("maps each tab's path to that tab", () => {
    for (const { id } of TABS) expect(parseTab(`/${id}`)).toBe(id);
  });

  it("falls back to the default panel for the root path", () => {
    expect(parseTab("/")).toBe(DEFAULT_TAB);
    expect(parseTab("")).toBe(DEFAULT_TAB);
  });

  // An admin who mistypes a URL should land somewhere useful, not a dead end.
  it("falls back to the default panel for unknown paths", () => {
    expect(parseTab("/nope")).toBe(DEFAULT_TAB);
    expect(parseTab("/Awards")).toBe(DEFAULT_TAB); // tab ids are lower-case
  });

  it("still resolves the tab when a detail segment follows", () => {
    expect(parseTab("/awards/V1StGXR8_Z5")).toBe("awards");
    expect(parseTab("/awards/new")).toBe("awards");
  });
});

describe("parseAwardId", () => {
  it("reads an award id from the path", () => {
    expect(parseAwardId("/awards/V1StGXR8_Z5")).toBe("V1StGXR8_Z5");
  });

  it("reads the create sentinel", () => {
    expect(parseAwardId("/awards/new")).toBe(NEW_AWARD);
  });

  it("is empty on the list itself", () => {
    expect(parseAwardId("/awards")).toBe("");
    expect(parseAwardId("/")).toBe("");
  });

  // A stray segment must not put another panel into an editing state.
  it("is empty on other tabs", () => {
    expect(parseAwardId("/scores/V1StGXR8_Z5")).toBe("");
    expect(parseAwardId("/settings/new")).toBe("");
  });

  // The id goes straight into an API path.
  it("drops ids that are not safe path segments", () => {
    expect(parseAwardId("/awards/..%2F..%2Fadmin")).toBe("");
    expect(parseAwardId("/awards/a b")).toBe("");
  });

  it("ignores deeper paths rather than guessing", () => {
    expect(parseAwardId("/awards/abc/extra")).toBe("");
  });
});

describe("query parameters", () => {
  it("reads a safe game slug and drops anything else", () => {
    expect(parseGameSlug("?game=tap-fast")).toBe("tap-fast");
    expect(parseGameSlug("?game=../../admin/awards")).toBe("");
    expect(parseGameSlug("")).toBe("");
  });

  it("reads the enum filters", () => {
    expect(parseStatus("?status=active")).toBe("active");
    expect(parseStock("?stock=out")).toBe("out");
    expect(parseSort("?sort=name")).toBe("name");
  });

  // A stale or hand-edited value must degrade to the default, or an admin sees
  // a filtered list while every control claims "All".
  it("falls back to the default for unknown enum values", () => {
    expect(parseStatus("?status=banana")).toBe("all");
    expect(parseStock("?stock=")).toBe("all");
    expect(parseSort("?sort=sideways")).toBe("order");
  });

  it("trims and caps the name search", () => {
    expect(parseQuery("?q=%20coffee%20")).toBe("coffee");
    expect(parseQuery(`?q=${"a".repeat(80)}`)).toHaveLength(60);
    expect(parseQuery("")).toBe("");
  });
});

describe("isSafeSlug / isTab", () => {
  it("accepts slug characters only", () => {
    expect(isSafeSlug("tap-fast")).toBe(true);
    expect(isSafeSlug("a_B9")).toBe(true);
    expect(isSafeSlug("")).toBe(false);
    expect(isSafeSlug("a/b")).toBe(false);
  });

  it("narrows only known tab ids", () => {
    expect(isTab("awards")).toBe(true);
    expect(isTab("nope")).toBe(false);
  });
});

describe("hrefFor", () => {
  it("renders a bare path when everything is at its default", () => {
    expect(hrefFor(at())).toBe("/awards");
    expect(hrefFor(at({ tab: "settings" }))).toBe("/settings");
  });

  it("omits parameters that equal their default", () => {
    expect(hrefFor(at({ status: "all", stock: "all", sort: "order" }))).toBe("/awards");
  });

  it("emits only the filters that differ", () => {
    expect(hrefFor(at({ status: "active" }))).toBe("/awards?status=active");
    expect(hrefFor(at({ sort: "stock" }))).toBe("/awards?sort=stock");
    expect(hrefFor(at({ query: "coffee" }))).toBe("/awards?q=coffee");
  });

  // ?game= is shared, so an admin investigating one game keeps it across panels.
  it("carries the game filter on both awards and scores", () => {
    expect(hrefFor(at({ gameSlug: "tap-fast" }))).toBe("/awards?game=tap-fast");
    expect(hrefFor(at({ tab: "scores", gameSlug: "tap-fast" }))).toBe("/scores?game=tap-fast");
  });

  it("drops the game filter on a panel that does not use it", () => {
    expect(hrefFor(at({ tab: "settings", gameSlug: "tap-fast" }))).toBe("/settings");
  });

  // Award filters are the awards list's own; dragging them elsewhere would
  // leave dead parameters in the URL.
  it("drops award filters on other tabs", () => {
    expect(hrefFor(at({ tab: "scores", status: "active", query: "x", sort: "name" }))).toBe("/scores");
  });

  it("renders award detail paths", () => {
    expect(hrefFor(at({ awardId: NEW_AWARD }))).toBe("/awards/new");
    expect(hrefFor(at({ awardId: "V1StGXR8_Z5" }))).toBe("/awards/V1StGXR8_Z5");
  });

  // Leaving the form must return to the list the admin came from.
  it("keeps filters on an award detail page", () => {
    expect(hrefFor(at({ awardId: "V1StGXR8_Z5", gameSlug: "tap-fast", status: "active" }))).toBe(
      "/awards/V1StGXR8_Z5?game=tap-fast&status=active",
    );
  });
});

describe("round trip", () => {
  it("parses back every href it renders", () => {
    const cases: Location[] = [
      at(),
      at({ tab: "settings" }),
      at({ tab: "scores", gameSlug: "reaction-timer" }),
      at({ gameSlug: "tap-fast", status: "inactive", stock: "out", query: "coffee", sort: "name" }),
      at({ awardId: NEW_AWARD }),
      at({ awardId: "V1StGXR8_Z5", gameSlug: "tap-fast" }),
    ];
    for (const loc of cases) {
      const [pathname, search] = hrefFor(loc).split("?");
      expect(parseLocation(pathname, search ? `?${search}` : "")).toEqual(loc);
    }
  });

  it("pathFor is the inverse of parseTab", () => {
    for (const { id } of TABS) expect(parseTab(pathFor(id))).toBe(id);
  });
});

describe("resolveGameSlug", () => {
  const catalog = ["tap-fast", "reaction-timer"];

  it("honours a requested game that exists", () => {
    expect(resolveGameSlug("reaction-timer", catalog)).toBe("reaction-timer");
  });

  it("defaults to the first game when nothing is requested", () => {
    expect(resolveGameSlug("", catalog)).toBe("tap-fast");
  });

  // A stale bookmark must not send a slug the backend will 404 on.
  it("falls back when the requested game is not in the catalog", () => {
    expect(resolveGameSlug("retired-game", catalog)).toBe("tap-fast");
  });

  it("is empty when the catalog is empty", () => {
    expect(resolveGameSlug("tap-fast", [])).toBe("");
  });
});

describe("hasActiveFilters", () => {
  it("is false when nothing narrows the list", () => {
    expect(hasActiveFilters(at())).toBe(false);
  });

  it("is true for any narrowing filter", () => {
    expect(hasActiveFilters(at({ gameSlug: "tap-fast" }))).toBe(true);
    expect(hasActiveFilters(at({ status: "active" }))).toBe(true);
    expect(hasActiveFilters(at({ stock: "out" }))).toBe(true);
    expect(hasActiveFilters(at({ query: "x" }))).toBe(true);
  });

  // Sort changes presentation, not membership — it is not a filter.
  it("ignores the sort order", () => {
    expect(hasActiveFilters(at({ sort: "name" }))).toBe(false);
  });
});

describe("clearedFilters", () => {
  it("resets every filter but keeps the tab and sort", () => {
    const got = clearedFilters(
      at({ tab: "awards", gameSlug: "tap-fast", status: "active", stock: "out", query: "x", sort: "name" }),
    );
    expect(got).toEqual(at({ sort: "name" }));
  });

  it("does not close an open award", () => {
    expect(clearedFilters(at({ awardId: "V1StGXR8_Z5", query: "x" })).awardId).toBe("V1StGXR8_Z5");
  });
});

describe("sameLocation", () => {
  it("ignores state the tab would not render", () => {
    expect(sameLocation(at({ tab: "settings" }), at({ tab: "settings", query: "x" }))).toBe(true);
  });

  it("distinguishes different tabs, filters and awards", () => {
    expect(sameLocation(at(), at({ tab: "scores" }))).toBe(false);
    expect(sameLocation(at(), at({ status: "active" }))).toBe(false);
    expect(sameLocation(at(), at({ awardId: NEW_AWARD }))).toBe(false);
  });
});
