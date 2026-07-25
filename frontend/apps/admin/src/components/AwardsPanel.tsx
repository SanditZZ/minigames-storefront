import { useCallback, useEffect, useState } from "react";
import type { ApiClient, Award, AwardInput, Game } from "@minigames/api-client";
import { UNLIMITED_STOCK } from "@minigames/api-client";
import { AwardForm } from "./AwardForm";
import { Alert, Badge, Button, Card, EmptyState, Loading, PanelHeader, Stack } from "../ui";

type Editing = Award | "new" | null;

/**
 * Awards CRUD. Data always comes from and returns to the backend — this panel
 * holds no award rules, it just presents the list and drives create/update/
 * delete through the typed client.
 */
export function AwardsPanel({ api, games }: { api: ApiClient; games: Game[] }) {
  const [awards, setAwards] = useState<Award[] | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .listAwards()
      .then(setAwards)
      .catch((e) => setError(e.message ?? "Failed to load awards"));
  }, [api]);

  useEffect(load, [load]);

  async function save(input: AwardInput) {
    setBusy(true);
    setError("");
    try {
      if (editing === "new") await api.createAward(input);
      else if (editing) await api.updateAward(editing.id, input);
      setEditing(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setConfirmId(null);
    try {
      await api.deleteAward(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const gameName = (slug: string) => games.find((g) => g.slug === slug)?.name ?? "Any game";

  if (editing) {
    return (
      <Card>
        <h2 className="mb-4 text-lg font-bold text-ink">{editing === "new" ? "New award" : "Edit award"}</h2>
        <AwardForm
          initial={editing === "new" ? undefined : editing}
          games={games}
          busy={busy}
          onSubmit={save}
          onCancel={() => setEditing(null)}
        />
      </Card>
    );
  }

  return (
    <Stack>
      <PanelHeader
        title="Awards"
        action={<Button onClick={() => setEditing("new")}>+ New award</Button>}
      />

      <Alert message={error} />

      {awards === null ? (
        <Loading />
      ) : awards.length === 0 ? (
        <EmptyState>No awards yet. Create the first prize.</EmptyState>
      ) : (
        <Stack gap="sm">
          {awards.map((a) => (
            <Card key={a.id} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold text-ink">{a.name}</span>
                  <Badge tone={a.active ? "on" : "off"}>{a.active ? "Active" : "Inactive"}</Badge>
                </div>
                <div className="mt-1 text-sm text-ink/60">
                  {gameName(a.gameSlug)} · min {a.minScore} ·{" "}
                  {a.stock === UNLIMITED_STOCK ? "unlimited stock" : `${a.stock} in stock`}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" onClick={() => setEditing(a)}>
                  Edit
                </Button>
                {confirmId === a.id ? (
                  <>
                    <Button variant="danger" onClick={() => remove(a.id)}>
                      Confirm
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmId(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button variant="danger" onClick={() => setConfirmId(a.id)}>
                    Delete
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
