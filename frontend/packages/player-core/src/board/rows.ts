// CALCULATIONS: which rows a leaderboard renders, given the top N and the row
// the player is entitled to see whatever their rank.
//
// The board shows a fixed window (the backend's `high_score_limit`, ten by
// default). That is right for the board and wrong for the player, who was
// looking for themselves: ranked #23, they get ten strangers and no evidence
// they played. Pinning their own row below a gap is the convention every
// leaderboard settles on, and it costs one calculation rather than a second
// request — the rank came back with the submission.
//
// Membership is decided by ID, never by rank. A rank is a claim about an
// ordering that was computed on the server at submit time, while the board is
// a list fetched separately; if the two disagree — a round submitted between
// the two calls is enough — comparing ranks would either hide the player's row
// or print it twice. An id either is in the list or is not.

/** One rendered row: a ranked entry, or the elision between the top and a pinned row. */
export type BoardRow<T> = { kind: "score"; entry: T; rank: number } | { kind: "gap" };

/**
 * Numbers the visible window and appends the player's own row when it falls
 * outside it.
 *
 * `own` is null when there is nobody to pin — the landing screen's board has no
 * "you", and a result screen for a round that never made the table would pass
 * a rank the server did not give it. A pinned row that is ALREADY in the window
 * is returned unpinned rather than duplicated, which is the common case: most
 * players who just played are on the board they are looking at.
 */
export function boardRows<T extends { id: string }>(
  top: readonly T[],
  own: { entry: T; rank: number } | null,
): BoardRow<T>[] {
  const rows: BoardRow<T>[] = top.map((entry, i) => ({ kind: "score", entry, rank: i + 1 }));
  if (!own) return rows;
  if (top.some((e) => e.id === own.entry.id)) return rows;

  // A gap only reads as one when there is something above it to be separated
  // from. On an empty board the player's row is the whole board.
  if (rows.length > 0) rows.push({ kind: "gap" });
  rows.push({ kind: "score", entry: own.entry, rank: own.rank });
  return rows;
}
