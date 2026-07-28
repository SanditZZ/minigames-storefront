import type { ScoreEntry } from "@minigames/api-client";
import { boardRows } from "@minigames/player-core";
import { useT } from "../i18n";
import { EmptyNote, Panel, ScoreGapRow, ScoreRow } from "../ui";

interface Props {
  /** null while loading. Ordering is the backend's decision, not ours. */
  scores: ScoreEntry[] | null;
  unit: string;
  /**
   * The row this player is entitled to see whatever their rank, or null when
   * there is no "you" on this screen.
   *
   * It carries the rank because the board cannot derive one for a player who is
   * not on it: the window is the top ten, and #23 is not in it to be counted.
   * The rank came back with the submission, so this is a read rather than a
   * second request. It also replaces the old `highlightId` — the row to
   * emphasise and the row to pin were always the same row.
   */
  own?: { entry: ScoreEntry; rank: number } | null;
}

/**
 * A compact top-N leaderboard, plus the player's own row when it falls outside
 * that window. Purely presentational — the screen that shows it owns the fetch,
 * so the same data can also feed the reveal meter without requesting it twice,
 * and `boardRows` (@minigames/player-core) decides what ends up on screen.
 */
export function Leaderboard({ scores, unit, own = null }: Props) {
  const t = useT();
  const rows = scores === null ? [] : boardRows(scores, own);

  return (
    // `unit` arrives already translated — it is the game's score unit, which
    // the backend serves in the requested language (see internal/i18n).
    <Panel title={t("board.title")} className="w-full max-w-sm">
      {scores === null ? (
        <EmptyNote>{t("board.loading")}</EmptyNote>
      ) : rows.length === 0 ? (
        <EmptyNote>{t("board.empty")}</EmptyNote>
      ) : (
        <ol className="flex flex-col gap-1">
          {rows.map((row, i) =>
            row.kind === "gap" ? (
              // Keyed by position, and it is stable: there is at most one gap
              // and it is always the second-to-last row.
              <ScoreGapRow key={`gap-${i}`} />
            ) : (
              <ScoreRow
                key={row.entry.id}
                rank={row.rank}
                name={row.entry.playerName}
                value={row.entry.value}
                unit={unit}
                highlighted={row.entry.id === own?.entry.id}
              />
            ),
          )}
        </ol>
      )}
    </Panel>
  );
}
