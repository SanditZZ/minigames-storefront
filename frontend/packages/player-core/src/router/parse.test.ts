import { describe, expect, it } from "vitest";
import { hrefFor, parseLocation, parsePath, parsePlayerName, parseReveal, pathFor, sameLocation } from "./parse";
import type { Location, Route } from "./routes";

describe("parsePath", () => {
  it("maps the known routes", () => {
    expect(parsePath("/")).toEqual({ name: "home" });
    expect(parsePath("/play/tap-fast")).toEqual({ name: "play", slug: "tap-fast" });
    expect(parsePath("/result/tap-fast/abc-123")).toEqual({
      name: "result",
      slug: "tap-fast",
      scoreId: "abc-123",
    });
  });

  it("tolerates trailing and repeated slashes", () => {
    expect(parsePath("")).toEqual({ name: "home" });
    expect(parsePath("//")).toEqual({ name: "home" });
    expect(parsePath("/play/tap-fast/")).toEqual({ name: "play", slug: "tap-fast" });
  });

  it("rejects segments that could be smuggled into an API path", () => {
    // These must never reach the client, which interpolates the slug/id
    // straight into a request URL.
    for (const path of [
      "/play/..%2F..%2Fadmin",
      "/play/tap fast",
      "/result/tap-fast/../../admin/awards",
      "/result/tap-fast/a?b",
      `/play/${"x".repeat(65)}`,
    ]) {
      expect(parsePath(path).name, path).toBe("notFound");
    }
  });

  it("treats the wrong number of segments as unknown", () => {
    expect(parsePath("/play").name).toBe("notFound");
    expect(parsePath("/play/a/b").name).toBe("notFound");
    expect(parsePath("/result/tap-fast").name).toBe("notFound");
    expect(parsePath("/nonsense").name).toBe("notFound");
  });
});

describe("parsePlayerName", () => {
  it("trims and caps to the backend's limit", () => {
    expect(parsePlayerName("?name=%20Po%20")).toBe("Po");
    expect(parsePlayerName(`?name=${"a".repeat(60)}`)).toHaveLength(40);
  });

  it("is empty when absent", () => {
    expect(parsePlayerName("")).toBe("");
    expect(parsePlayerName("?other=1")).toBe("");
  });
});

describe("parseReveal", () => {
  it("is only true for an explicit 1", () => {
    expect(parseReveal("?reveal=1")).toBe(true);
    expect(parseReveal("?reveal=0")).toBe(false);
    expect(parseReveal("?reveal=true")).toBe(false);
    expect(parseReveal("")).toBe(false);
  });
});

describe("hrefFor", () => {
  const result: Route = { name: "result", slug: "tap-fast", scoreId: "abc" };

  it("omits empty query state", () => {
    expect(hrefFor({ route: { name: "home" }, playerName: "", reveal: false, lang: null })).toBe("/");
  });

  it("carries the player name", () => {
    expect(hrefFor({ route: { name: "play", slug: "tap-fast" }, playerName: "Po", reveal: false, lang: null })).toBe(
      "/play/tap-fast?name=Po",
    );
  });

  it("emits reveal only on a result route", () => {
    expect(hrefFor({ route: result, playerName: "", reveal: true, lang: null })).toBe("/result/tap-fast/abc?reveal=1");
    // Meaningless anywhere else, so it must not leak into other URLs.
    expect(hrefFor({ route: { name: "home" }, playerName: "", reveal: true, lang: null })).toBe("/");
  });

  // An unpinned language writes nothing, so a bare link stays bare and still
  // adapts to the device that opens it. A pinned one travels with the link,
  // which is the point of pinning: the kiosk's language survives being shared.
  it("writes the language only when it is pinned", () => {
    expect(hrefFor({ route: { name: "home" }, playerName: "", reveal: false, lang: null })).toBe("/");
    expect(hrefFor({ route: { name: "home" }, playerName: "", reveal: false, lang: "th" })).toBe(
      "/?lang=th",
    );
    // Pinned English is still a pin, not a default: it has to survive a reload
    // on a Thai phone, so it is written like any other choice.
    expect(hrefFor({ route: { name: "home" }, playerName: "", reveal: false, lang: "en" })).toBe(
      "/?lang=en",
    );
  });

  it("encodes names that would otherwise break the query string", () => {
    const href = hrefFor({ route: { name: "home" }, playerName: "A&B=C", reveal: false, lang: null });
    expect(href).toBe("/?name=A%26B%3DC");
    expect(parsePlayerName(href.slice(href.indexOf("?")))).toBe("A&B=C");
  });
});

describe("round-tripping", () => {
  const locations: Location[] = [
    { route: { name: "home" }, playerName: "", reveal: false, lang: null },
    { route: { name: "home" }, playerName: "Po", reveal: false, lang: null },
    { route: { name: "play", slug: "tap-fast" }, playerName: "Po", reveal: false, lang: null },
    { route: { name: "result", slug: "tap-fast", scoreId: "abc-123" }, playerName: "Po", reveal: true, lang: null },
    { route: { name: "result", slug: "tap-fast", scoreId: "abc-123" }, playerName: "", reveal: false, lang: null },
    { route: { name: "home" }, playerName: "Po", reveal: false, lang: "th" },
    { route: { name: "play", slug: "tap-fast" }, playerName: "", reveal: false, lang: "en" },
  ];

  it("parses back to exactly what it rendered", () => {
    for (const loc of locations) {
      const href = hrefFor(loc);
      const [pathname, search = ""] = href.split("?");
      expect(parseLocation(pathname, search ? `?${search}` : ""), href).toEqual(loc);
    }
  });

  it("pathFor inverts parsePath", () => {
    for (const path of ["/", "/play/tap-fast", "/result/tap-fast/abc-123"]) {
      expect(pathFor(parsePath(path))).toBe(path);
    }
  });
});

describe("sameLocation", () => {
  it("compares the whole addressable location, query included", () => {
    const base: Location = { route: { name: "home" }, playerName: "Po", reveal: false, lang: null };
    expect(sameLocation(base, { ...base })).toBe(true);
    expect(sameLocation(base, { ...base, playerName: "Sam" })).toBe(false);
  });
});
