import { useEffect, useState } from "react";
import type { Game, ScoreEntry } from "@minigames/api-client";
import { api } from "../api";
import { Card } from "../ui";

/**
 * A compact top-N leaderboard for a game. Ordering is decided by the backend
 * (it knows each game's score direction), so this only renders rows.
 */
export function Leaderboard({ game, highlightId }: { game: Game; highlightId?: string }) {
  const [scores, setScores] = useState<ScoreEntry[] | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .highScores(game.slug, 10)
      .then((r) => alive && setScores(r.scores ?? []))
      .catch(() => alive && setScores([]));
    return () => {
      alive = false;
    };
  }, [game.slug]);

  return (
    <Card tone="muted" className="w-full max-w-sm">
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink/70">Top players</h3>
      {scores === null ? (
        <p className="py-4 text-center text-sm text-ink/50">Loading…</p>
      ) : scores.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink/50">Be the first on the board!</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {scores.map((s, i) => (
            <li
              key={s.id}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                s.id === highlightId ? "bg-brand font-semibold text-ink" : "text-ink/80"
              }`}
            >
              <span className="w-6 shrink-0 text-center font-bold tabular-nums">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{s.playerName}</span>
              <span className="shrink-0 font-bold tabular-nums">
                {s.value} {game.scoreUnit}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
