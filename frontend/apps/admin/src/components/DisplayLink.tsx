import { useState } from "react";
import type { Game } from "@minigames/api-client";
import { displayUrlFor } from "@minigames/admin-core";
import { Card, EmptyState, Field, Input, PanelHeader, QrGlyph, Select, Stack } from "../ui";

/**
 * Falls back to the local dev default for the player app's port
 * (`apps/player`'s own `VITE_API_BASE_URL` fallback is the same idea, one
 * layer down) — `scripts/serve-prod.sh` and `e2e/playwright.config.ts` both
 * set the real one at build time, but a bare `npm run dev` sets neither.
 */
const DEFAULT_PLAYER_BASE_URL = "http://localhost:3000";

/**
 * The store's TV/kiosk display link — issue #6's "how does an operator get
 * this onto a monitor" — one card, one game at a time (auto-cycling between
 * every enabled game is filed as a follow-up rather than built here).
 *
 * Reads the SAME `games` list every other settings card gets from `App`,
 * filtered to `enabled`: a disabled game has no player-facing route at all,
 * so linking to its display would be a dead end nothing else in this app
 * produces.
 */
export function DisplayLink({ games }: { games: Game[] }) {
  const enabled = games.filter((g) => g.enabled);
  const [slug, setSlug] = useState(enabled[0]?.slug ?? "");
  // The selection can point at a game that just got disabled out from under
  // it; fall back to the first still-enabled one rather than showing a URL
  // for a game that no longer takes players.
  const selected = enabled.find((g) => g.slug === slug) ?? enabled[0] ?? null;

  if (!selected) {
    return (
      <Card>
        <PanelHeader title="Display screen" />
        <EmptyState>Enable a game to get its TV/kiosk display link.</EmptyState>
      </Card>
    );
  }

  const baseUrl = import.meta.env.VITE_PLAYER_BASE_URL ?? DEFAULT_PLAYER_BASE_URL;
  const url = displayUrlFor(baseUrl, selected.slug);

  return (
    <Card>
      <PanelHeader title="Display screen" />
      <p className="mt-1 text-sm text-ink/60">
        An ambient, no-interaction leaderboard for a TV or monitor behind the counter — no name entry, just the
        board, updating on its own.
      </p>
      <Stack gap="sm" className="mt-3">
        <Field label="Game">
          <Select value={selected.slug} onChange={(e) => setSlug(e.target.value)}>
            {enabled.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="URL">
          {/* Click-to-select rather than a copy button: this app has none yet
              (the player's CopyButton is a phone-first affordance for an
              eight-character code, not built for a URL or for this app), and
              selecting the whole field is enough for an operator to Ctrl/Cmd-C
              it into a TV's browser. */}
          <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
        </Field>
        <div className="flex justify-center py-2">
          <QrGlyph value={url} label={`QR code for the ${selected.name} display screen`} className="h-40 w-40" />
        </div>
      </Stack>
    </Card>
  );
}
