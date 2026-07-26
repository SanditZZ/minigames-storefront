import type { ScoreEntry } from "@minigames/api-client";
import { useT } from "../i18n";
import { EmptyNote, Panel, ScoreRow } from "../ui";

interface Props {
  /** null while loading. Ordering is the backend's decision, not ours. */
  scores: ScoreEntry[] | null;
  unit: string;
  highlightId?: string;
}

/**
 * A compact top-N leaderboard. Purely presentational — the screen that shows it
 * owns the fetch, so the same data can also feed the reveal meter without
 * requesting it twice.
 */
export function Leaderboard({ scores, unit, highlightId }: Props) {
  const t = useT();

  return (
    // `unit` arrives already translated — it is the game's score unit, which
    // the backend serves in the requested language (see internal/i18n).
    <Panel title={t("board.title")} className="w-full max-w-sm">
      {scores === null ? (
        <EmptyNote>{t("board.loading")}</EmptyNote>
      ) : scores.length === 0 ? (
        <EmptyNote>{t("board.empty")}</EmptyNote>
      ) : (
        <ol className="flex flex-col gap-1">
          {scores.map((s, i) => (
            <ScoreRow
              key={s.id}
              rank={i + 1}
              name={s.playerName}
              value={s.value}
              unit={unit}
              highlighted={s.id === highlightId}
            />
          ))}
        </ol>
      )}
    </Panel>
  );
}
