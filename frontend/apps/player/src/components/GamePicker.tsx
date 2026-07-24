import type { Game } from "@minigames/api-client";
import { getMiniGame } from "../games/registry";

interface Props {
  games: Game[];
  playerName: string;
  onNameChange: (name: string) => void;
  onPick: (game: Game) => void;
}

/**
 * Landing screen: capture an optional display name and list playable games.
 * A backend game this client build can't render is shown disabled (not hidden),
 * so a version mismatch is visible during rollout. Uses shared theme tokens.
 */
export function GamePicker({ games, playerName, onNameChange, onPick }: Props) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="text-center">
        <h1 className="text-3xl font-black text-ink">Play &amp; Win 🎁</h1>
        <p className="mt-1 text-ink/70">Thanks for shopping with us — try your luck!</p>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink/80">Your name (optional)</span>
        <input
          value={playerName}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={40}
          placeholder="Guest"
          className="w-full rounded-xl border-0 bg-white px-4 py-3 text-lg text-ink placeholder-ink/40 outline-none ring-2 ring-transparent focus:ring-brand"
        />
      </label>

      <div className="flex flex-col gap-3">
        {games.map((game) => {
          const playable = Boolean(getMiniGame(game.slug));
          return (
            <button
              key={game.slug}
              type="button"
              disabled={!playable}
              onClick={() => onPick(game)}
              className="flex items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-lg transition active:scale-[0.98] disabled:opacity-50"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-bold text-ink">{game.name}</div>
                <div className="line-clamp-2 text-sm text-ink/60">{game.description}</div>
              </div>
              <span className="shrink-0 whitespace-nowrap rounded-lg bg-brand px-4 py-2 text-sm font-bold text-ink">
                {playable ? "Play" : "Soon"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
