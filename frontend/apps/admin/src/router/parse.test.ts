import { describe, expect, it } from "vitest";
import {
  hrefFor,
  isSafeSlug,
  isTab,
  parseGameSlug,
  parseLocation,
  parseTab,
  pathFor,
  resolveGameSlug,
  sameLocation,
} from "./parse";
import { DEFAULT_TAB, TABS, type Location } from "./routes";

describe("parseTab", () => {
  it("maps each tab's path to that tab", () => {
    for (const { id } of TABS) {
      expect(parseTab(`/${id}`)).toBe(id);
    }
  });

  it("falls back to the default panel for the root path", () => {
    expect(parseTab("/")).toBe(DEFAULT_TAB);
    expect(parseTab("")).toBe(DEFAULT_TAB);
  });

  // An admin who mistypes a URL should land somewhere useful, not a dead end.
  it("falls back to the default panel for unknown or nested paths", () => {
    expect(parseTab("/nope")).toBe(DEFAULT_TAB);
    expect(parseTab("/awards/extra")).toBe(DEFAULT_TAB);
    expect(parseTab("/Awards")).toBe(DEFAULT_TAB); // tab ids are lower-case
  });
});

describe("parseGameSlug", () => {
  it("reads a safe slug", () => {
    expect(parseGameSlug("?game=tap-fast")).toBe("tap-fast");
    expect(parseGameSlug("?game=reaction-timer")).toBe("reaction-timer");
  });

  it("is empty when absent", () => {
    expect(parseGameSlug("")).toBe("");
    expect(parseGameSlug("?other=1")).toBe("");
  });

  // The slug goes straight into an API path, so anything path-like is dropped
  // rather than forwarded.
  it("drops unsafe values instead of passing them to the API", () => {
    expect(parseGameSlug("?game=../../admin/awards")).toBe("");
    expect(parseGameSlug("?game=tap fast")).toBe("");
    expect(parseGameSlug("?game=")).toBe("");
    expect(parseGameSlug(`?game=${"a".repeat(65)}`)).toBe("");
  });
});

describe("isSafeSlug", () => {
  it("accepts slug characters only", () => {
    expect(isSafeSlug("tap-fast")).toBe(true);
    expect(isSafeSlug("a_B9")).toBe(true);
    expect(isSafeSlug("")).toBe(false);
    expect(isSafeSlug("a/b")).toBe(false);
    expect(isSafeSlug("a.b")).toBe(false);
  });
});

describe("isTab", () => {
  it("narrows only known tab ids", () => {
    expect(isTab("awards")).toBe(true);
    expect(isTab("scores")).toBe(true);
    expect(isTab("nope")).toBe(false);
  });
});

describe("hrefFor", () => {
  it("renders a bare path when no game filter is set", () => {
    expect(hrefFor({ tab: "awards", gameSlug: "" })).toBe("/awards");
    expect(hrefFor({ tab: "settings", gameSlug: "" })).toBe("/settings");
  });

  it("carries the game filter on the scores panel", () => {
    expect(hrefFor({ tab: "scores", gameSlug: "tap-fast" })).toBe("/scores?game=tap-fast");
  });

  // The filter means nothing elsewhere; emitting it would leave a stale
  // parameter in the URL after switching tabs.
  it("drops the game filter on panels that do not use it", () => {
    expect(hrefFor({ tab: "awards", gameSlug: "tap-fast" })).toBe("/awards");
    expect(hrefFor({ tab: "settings", gameSlug: "tap-fast" })).toBe("/settings");
  });
});

describe("round trip", () => {
  it("parses back every href it renders", () => {
    const cases: Location[] = [
      { tab: "awards", gameSlug: "" },
      { tab: "settings", gameSlug: "" },
      { tab: "scores", gameSlug: "" },
      { tab: "scores", gameSlug: "reaction-timer" },
    ];
    for (const loc of cases) {
      const href = hrefFor(loc);
      const [pathname, search] = href.split("?");
      expect(parseLocation(pathname, search ? `?${search}` : "")).toEqual(loc);
    }
  });

  it("pathFor is the inverse of parseTab", () => {
    for (const { id } of TABS) {
      expect(parseTab(pathFor(id))).toBe(id);
    }
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
    expect(resolveGameSlug("", [])).toBe("");
  });
});

describe("sameLocation", () => {
  it("ignores a game filter the tab would not render", () => {
    expect(sameLocation({ tab: "awards", gameSlug: "" }, { tab: "awards", gameSlug: "tap-fast" })).toBe(true);
  });

  it("distinguishes different tabs and different filters", () => {
    expect(sameLocation({ tab: "awards", gameSlug: "" }, { tab: "scores", gameSlug: "" })).toBe(false);
    expect(
      sameLocation({ tab: "scores", gameSlug: "tap-fast" }, { tab: "scores", gameSlug: "reaction-timer" }),
    ).toBe(false);
  });
});
