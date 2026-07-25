import { useEffect, useMemo, useState } from "react";
import type { ApiClient, Game, ScoreEntry } from "@minigames/api-client";
import { resolveGameSlug } from "../router";
import { Card, EmptyState, Loading, PanelHeader, RankRow, Select, Stack } from "../ui";

interface Props {
  api: ApiClient;
  games: Game[];
  /** Requested game from ?game=; "" when unset. */
  slug: string;
  onSlugChange: (slug: string) => void;
}

/**
 * Read-only leaderboard viewer for admins. Uses the same public high-scores
 * endpoint the player app does; ordering is decided by the backend per game.
 *
 * The selected game lives in the URL (?game=), so a link to one game's board is
 * shareable. The catalog arrives asynchronously and may not contain the
 * requested slug, so the effective selection is resolved by a pure function
 * rather than mirrored into state that could drift from the address bar.
 */
export function ScoresPanel({ api, games, slug: requested, onSlugChange }: Props) {
  const [scores, setScores] = useState<ScoreEntry[] | null>(null);
  const [unit, setUnit] = useState("");

  const slug = useMemo(
    () => resolveGameSlug(requested, games.map((g) => g.slug)),
    [requested, games],
  );

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
            <Select value={slug} onChange={(e) => onSlugChange(e.target.value)} aria-label="Game">
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
