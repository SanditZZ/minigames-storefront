import { useEffect, useState } from "react";
import type { ApiClient, Game, ScoreEntry } from "@minigames/api-client";
import { Card, Select } from "../ui";

/**
 * Read-only leaderboard viewer for admins. Uses the same public high-scores
 * endpoint the player app does; ordering is decided by the backend per game.
 */
export function ScoresPanel({ api, games }: { api: ApiClient; games: Game[] }) {
  const [slug, setSlug] = useState(games[0]?.slug ?? "");
  const [scores, setScores] = useState<ScoreEntry[] | null>(null);
  const [unit, setUnit] = useState("");

  useEffect(() => {
    if (!slug) return;
    setScores(null);
    api
      .highScores(slug, 25)
      .then((r) => {
        setScores(r.scores ?? []);
        setUnit(r.game.scoreUnit);
      })
      .catch(() => setScores([]));
  }, [api, slug]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">High scores</h2>
        <div className="min-w-48">
          <Select value={slug} onChange={(e) => setSlug(e.target.value)}>
            {games.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Card>
        {scores === null ? (
          <p className="text-ink/50">Loading…</p>
        ) : scores.length === 0 ? (
          <p className="text-ink/60">No scores recorded for this game yet.</p>
        ) : (
          <ol className="flex flex-col divide-y divide-ink/10">
            {scores.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-6 shrink-0 text-center font-bold tabular-nums text-ink/50">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{s.playerName}</span>
                <span className="shrink-0 font-bold tabular-nums text-ink">
                  {s.value} {unit}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
