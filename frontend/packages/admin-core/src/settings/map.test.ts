import { describe, expect, it } from "vitest";
import type { Setting } from "@minigames/api-client";
import { settingValue, settingsToMap } from "./map";

const row = (key: string, value: string): Setting => ({
  key,
  value,
  type: "string",
  description: "",
  updatedAt: "2026-07-26T00:00:00Z",
});

describe("settingsToMap", () => {
  it("keys rows by name and drops the editing metadata", () => {
    expect(settingsToMap([row("store_name", "Corner Cafe"), row("color_ink", "#111111")])).toEqual({
      store_name: "Corner Cafe",
      color_ink: "#111111",
    });
  });

  it("is empty rather than null for an unloaded list", () => {
    expect(settingsToMap(null)).toEqual({});
    expect(settingsToMap(undefined)).toEqual({});
  });
});

describe("settingValue", () => {
  it("reads a value by key", () => {
    expect(settingValue([row("store_name", "Corner Cafe")], "store_name")).toBe("Corner Cafe");
  });

  // "" rather than undefined so it drops straight into a controlled input; an
  // unset setting and an empty one are the same thing to the admin form, and
  // both mean "fall back to the built-in default".
  it("returns an empty string for a key that is not set", () => {
    expect(settingValue([], "color_brand")).toBe("");
  });
});
