import { describe, expect, it } from "vitest";
import { ICONS, ICON_NAMES, type IconName } from "./data";
import type { IconPaths } from "./shape";

// What these guard is TRANSCRIPTION, not design. Every entry was copied out of
// Phosphor by hand, and the ways that goes wrong are all silent at runtime: a
// truncated `d` renders a fragment, an empty list renders nothing at all, and a
// name pasted over the wrong row renders the previous icon. None of those throw,
// and none of them fail a browser test either — an icon is `aria-hidden`, so the
// suite sees a screen that behaves correctly and looks wrong.

// `ICONS` is `as const`, so TypeScript knows each entry's exact contents and
// narrows `.length` to a literal — which makes `length === 0` a comparison the
// compiler rejects as impossible rather than a check that runs. Reading through
// the widened type is what turns these back into assertions about the data as
// it may be edited, not as it is pinned today.
const pathsOf = (name: IconName): IconPaths => ICONS[name];

describe("the icon table", () => {
  it("gives every name at least one path to draw", () => {
    const empty = ICON_NAMES.filter((name) => pathsOf(name).length === 0);
    expect(empty).toEqual([]);
  });

  it("starts every path with a move command", () => {
    // A `d` that survives a bad copy-paste usually loses its head or its tail.
    // The head is checkable: SVG path data has to open by moving the pen.
    const malformed = ICON_NAMES.flatMap((name) =>
      pathsOf(name)
        .filter((d) => !/^[Mm]/.test(d.trim()))
        .map((d) => `${name}: ${d.slice(0, 24)}…`),
    );
    expect(malformed).toEqual([]);
  });

  // There is deliberately NO "every path ends in Z" check here, though a filled
  // icon is a closed outline and it looks like there should be. `puzzle-piece`
  // ends `…h42.22` in Phosphor's own source: SVG closes a filled subpath
  // implicitly, so the set does not bother where the fill is unambiguous. The
  // assertion was written, it failed on exactly that one icon, and the upstream
  // file confirmed the data was right and the rule was wrong. Re-adding it means
  // special-casing one name, which is a test asserting its own exceptions.

  it("keeps the names sorted, so the file stays readable as it grows", () => {
    expect(ICON_NAMES).toEqual([...ICON_NAMES].sort());
  });

  it("has no two names drawing the same thing", () => {
    // Two identical path lists means a row was duplicated and only its key
    // edited — which renders a plausible-looking wrong icon, the one failure
    // mode here that a person genuinely might not spot.
    const byGeometry = new Map<string, string[]>();
    for (const name of ICON_NAMES) {
      const key = JSON.stringify(pathsOf(name));
      byGeometry.set(key, [...(byGeometry.get(key) ?? []), name]);
    }
    const collisions = [...byGeometry.values()].filter((names) => names.length > 1);
    expect(collisions).toEqual([]);
  });
});
