import { describe, expect, it } from "vitest";
import { boardRows } from "./rows";

const entry = (id: string) => ({ id });

describe("boardRows", () => {
  it("numbers the window from one, in the order the server sent", () => {
    expect(boardRows([entry("a"), entry("b")], null)).toEqual([
      { kind: "score", entry: entry("a"), rank: 1 },
      { kind: "score", entry: entry("b"), rank: 2 },
    ]);
  });

  it("pins the player's row below a gap when they fall outside the window", () => {
    const rows = boardRows([entry("a"), entry("b")], { entry: entry("z"), rank: 23 });

    expect(rows).toEqual([
      { kind: "score", entry: entry("a"), rank: 1 },
      { kind: "score", entry: entry("b"), rank: 2 },
      { kind: "gap" },
      { kind: "score", entry: entry("z"), rank: 23 },
    ]);
  });

  it("does not repeat a player who is already on the board", () => {
    // The common case: someone who just played is usually in the top ten. The
    // rank passed in is deliberately WRONG here — membership is decided by id,
    // so a stale rank must not produce a second row.
    const rows = boardRows([entry("a"), entry("b")], { entry: entry("b"), rank: 9 });

    expect(rows).toEqual([
      { kind: "score", entry: entry("a"), rank: 1 },
      { kind: "score", entry: entry("b"), rank: 2 },
    ]);
  });

  it("pins without a gap when there is nothing above to separate from", () => {
    // An empty window with a pinned row cannot happen from the server today —
    // a score that was just submitted is on the board — but a gap as the first
    // row would read as "there are entries above" and there are none.
    expect(boardRows([], { entry: entry("z"), rank: 1 })).toEqual([
      { kind: "score", entry: entry("z"), rank: 1 },
    ]);
  });

  it("leaves the window alone when there is nobody to pin", () => {
    expect(boardRows([], null)).toEqual([]);
  });
});
