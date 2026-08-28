import { useEffect, useState } from "react";
import type { Game, ScoreEntry } from "@minigames/api-client";
import { Leaderboard } from "../components/Leaderboard";
import { useApi, useT } from "../i18n";
import { Spinner, StatusMessage } from "../ui";

/** How many rows the display shows. Wider than the phone board (10) — a TV
 *  across a room has room for more names and nobody to scroll it. */
const DISPLAY_LIMIT = 15;

/** How often the board re-fetches. A screen nobody touches has no other signal
 *  telling it a new round just finished, so it has to ask. */
const POLL_MS = 5_000;

interface Props {
  /** null while the catalog is still loading. */
  game: Game | null;
  loading: boolean;
}

/**
 * Route: "/display/:slug" — an ambient, no-interaction leaderboard meant for a
 * TV or monitor rather than a player's phone (see docs/potential-features.md's
 * "Ticket/coin visual motif" follow-ups and issue #6 for the kiosk framing).
 *
 * Deliberately dumb: no name entry, no reveal animation, no back button — just
 * the board, polled. `boardRows`/`Leaderboard` are reused as-is (`own` stays
 * null, since there is no "you" on a screen nobody is playing from), and the
 * only new visual piece is the `size="lg"` variant those already take.
 */
export function DisplayScreen({ game, loading }: Props) {
  const t = useT();
  const api = useApi();
  const [scores, setScores] = useState<ScoreEntry[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!game) return;
    let alive = true;
    // Tracked locally rather than read off `scores` state, so a transient poll
    // failure after the board is already showing data stays silent instead of
    // flashing an error over a leaderboard that is still perfectly readable.
    let hasData = false;

    const poll = () => {
      api
        .highScores(game.slug, DISPLAY_LIMIT)
        .then((res) => {
          if (!alive) return;
          hasData = true;
          setScores(res.scores);
          setError("");
        })
        .catch(() => {
          if (!alive || hasData) return;
          setError(t("app.backendUnreachable"));
        });
    };

    setScores(null);
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [api, game, t]);

  if (loading) return <Spinner label={t("board.loading")} />;

  if (!game) {
    return <StatusMessage icon="compass" title={t("display.notFound")} />;
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 py-8 text-center">
      <div>
        <p className="text-lg font-bold uppercase tracking-wide text-ink/50 sm:text-xl">{t("display.live")}</p>
        <h1 className="text-5xl font-black text-ink sm:text-7xl">{game.name}</h1>
      </div>

      <Leaderboard scores={scores} unit={game.scoreUnit} size="lg" className="w-full max-w-4xl" />

      {error && <p className="text-sm text-ink/50">{error}</p>}
    </div>
  );
}
