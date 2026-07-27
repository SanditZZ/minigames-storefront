import { useMemo, useState } from "react";
import type { ApiClient, Game, Setting } from "@minigames/api-client";
import {
  benchmarkChanges,
  benchmarksDirty,
  invalidBenchmarks,
  readBenchmarks,
  targetScoreKey,
} from "@minigames/admin-core";
import { Alert, Button, Card, Field, NumberInput, PanelHeader, Stack } from "../ui";

/**
 * Per-game benchmark overrides — the score at which the player's reveal meter
 * reads full.
 *
 * The number is catalog data: it lives in Go, beside the game's duration and
 * scoring direction, and it is deliberately not a leaderboard-derived value
 * (a board that is its own denominator tells an empty store that everybody
 * broke the record). This card is the seam that lets a venue retune it — "our
 * tote bag is 40 taps, not 60" — without a code change and a redeploy.
 *
 * Leaving a box empty is how you go back to the catalog value; the placeholder
 * shows what that currently is. Note `game.targetScore` arriving from the API is
 * already the effective number, so once an override is saved the placeholder and
 * the value agree — which is correct, if briefly confusing when read as a diff.
 */
export function GameBenchmarks({
  api,
  games,
  settings,
  onSaved,
}: {
  api: ApiClient;
  games: Game[];
  settings: Setting[];
  onSaved: () => void;
}) {
  const saved = useMemo(() => readBenchmarks(games, settings), [games, settings]);
  const [draft, setDraft] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [base, setBase] = useState(saved);
  if (base !== saved) {
    if (!benchmarksDirty(draft, base)) setDraft(saved);
    setBase(saved);
  }

  const dirty = benchmarksDirty(draft, saved);
  const invalid = invalidBenchmarks(draft);

  async function save() {
    setBusy(true);
    setError("");
    try {
      for (const change of benchmarkChanges(draft, saved)) {
        if (change.value === "") {
          if (change.previous !== "") await api.deleteSetting(change.key).catch(() => {});
          continue;
        }
        await api.upsertSetting(change.key, {
          value: change.value,
          type: "int",
          description: `Benchmark for ${change.slug}: the score the reveal meter reads full at. Overrides the catalog value.`,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (games.length === 0) return null;

  return (
    <Card>
      <Stack gap="sm">
        <PanelHeader title="Game benchmarks" />
        <p className="text-sm text-ink/60">
          The score a player has to reach for the reveal meter to fill. Leave empty to use the
          value built into the game. Keep it in step with your hardest prize for that game —
          filling the meter and winning the top prize are meant to be the same moment.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {games.map((g) => (
            <Field key={g.slug} label={`${g.name} (${g.scoreUnit})`}>
              {/* The draft stays a STRING because empty means "use the value
                  built into the game" — a distinct state from any number, and the
                  one the placeholder is advertising. NumberInput speaks
                  number|null, so null maps back to "" and nothing else changes.
                  No steppers: a benchmark is a score, typed rather than nudged. */}
              <NumberInput
                label={`${g.name} benchmark`}
                bounds={{ min: 1, step: 1 }}
                value={draft[g.slug] ? Number(draft[g.slug]) : null}
                placeholder={String(g.targetScore)}
                suffix={g.scoreUnit}
                onChange={(v) => setDraft((d) => ({ ...d, [g.slug]: v === null ? "" : String(v) }))}
              />
              <span className="mt-1 block text-xs text-ink/50">
                {g.direction === "lower" ? "Lower is better" : "Higher is better"} ·{" "}
                <code>{targetScoreKey(g.slug)}</code>
              </span>
            </Field>
          ))}
        </div>

        <Alert message={error} />
        {invalid.length > 0 && (
          <Alert
            message={`A benchmark must be a whole number above zero: ${invalid.join(
              ", ",
            )}. Clear the box to use the built-in value.`}
          />
        )}

        <div className="flex flex-wrap gap-2">
          <Button disabled={!dirty || busy || invalid.length > 0} onClick={save}>
            {busy ? "Saving…" : "Save benchmarks"}
          </Button>
          <Button variant="ghost" disabled={!dirty || busy} onClick={() => setDraft(saved)}>
            Discard changes
          </Button>
        </div>
      </Stack>
    </Card>
  );
}
