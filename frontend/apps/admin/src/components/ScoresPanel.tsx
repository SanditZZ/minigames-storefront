import { useEffect, useState } from "react";
import type { ApiClient, Game, ScoreEntry } from "@minigames/api-client";
import { Card, EmptyState, Loading, PanelHeader, RankRow, Select, Stack } from "../ui";

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
    <Stack>
      <PanelHeader
        title="High scores"
        action={
          <div className="w-48">
            <Select value={slug} onChange={(e) => setSlug(e.target.value)} aria-label="Game">
              {games.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.name}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {scores === null ? (
        <Card>
          <Loading />
        </Card>
      ) : scores.length === 0 ? (
        <EmptyState>No scores recorded for this game yet.</EmptyState>
      ) : (
        <Card>
          <ol className="flex flex-col divide-y divide-ink/10">
            {scores.map((s, i) => (
              <RankRow key={s.id} rank={i + 1} name={s.playerName} value={s.value} unit={unit} />
            ))}
          </ol>
        </Card>
      )}
    </Stack>
  );
}
