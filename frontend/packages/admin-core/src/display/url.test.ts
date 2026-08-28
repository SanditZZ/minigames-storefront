import { describe, expect, it } from "vitest";
import { displayUrlFor } from "./url";

describe("displayUrlFor", () => {
  it("joins the base origin and slug", () => {
    expect(displayUrlFor("http://100.64.124.94:3000", "tap-fast")).toBe(
      "http://100.64.124.94:3000/display/tap-fast",
    );
  });

  it("strips a trailing slash on the base URL", () => {
    expect(displayUrlFor("http://100.64.124.94:3000/", "tap-fast")).toBe(
      "http://100.64.124.94:3000/display/tap-fast",
    );
    expect(displayUrlFor("http://100.64.124.94:3000//", "tap-fast")).toBe(
      "http://100.64.124.94:3000/display/tap-fast",
    );
  });
});
