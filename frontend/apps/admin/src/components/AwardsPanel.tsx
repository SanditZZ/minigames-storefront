import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiClient, Award, AwardInput, Game } from "@minigames/api-client";
import { UNLIMITED_STOCK } from "@minigames/api-client";
import { visibleAwards } from "@minigames/admin-core";
import { NEW_AWARD, type AdminRouter } from "../router";
import { AwardFilters } from "./AwardFilters";
import { AwardForm } from "./AwardForm";
import { Alert, Badge, Button, Card, EmptyState, Loading, PanelHeader, Stack } from "../ui";

interface Props {
  api: ApiClient;
  games: Game[];
  router: AdminRouter;
}

/**
 * Awards CRUD. Data always comes from and returns to the backend — this panel
 * holds no award rules, it just presents the list and drives create/update/
 * delete through the typed client.
 *
 * Both what is shown and what is being edited come from the URL: the filters
 * from the query string, the open award from the path (/awards/{id}). Nothing
 * about the view lives in component state, so every view is linkable and
 * survives a reload.
 */
export function AwardsPanel({ api, games, router }: Props) {
  const [awards, setAwards] = useState<Award[] | null>(null);
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

  const { location, awardId } = router;

  const shown = useMemo(
    () =>
      visibleAwards(
        awards ?? [],
        {
          gameSlug: location.gameSlug,
          status: location.status,
          stock: location.stock,
          query: location.query,
        },
        location.sort,
      ),
    [awards, location.gameSlug, location.status, location.stock, location.query, location.sort],
  );

  async function save(input: AwardInput) {
    setBusy(true);
    setError("");
    try {
      if (awardId === NEW_AWARD) await api.createAward(input);
      else await api.updateAward(awardId, input);
      router.closeAward();
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

  // --- Detail page: /awards/new or /awards/{id} ------------------------------

  if (awardId) {
    // The list has to arrive before "not found" can be told apart from "not
    // loaded yet" — otherwise reloading straight onto an edit URL would flash a
    // false error before the data lands.
    if (awardId !== NEW_AWARD && awards === null) return <Loading />;

    const editing = awardId === NEW_AWARD ? undefined : awards?.find((a) => a.id === awardId);

    if (awardId !== NEW_AWARD && !editing) {
      return (
        <Stack>
          <Alert message={error} />
          <EmptyState>
            That award no longer exists — it may have been deleted since this link was made.
          </EmptyState>
          <div>
            <Button onClick={router.closeAward}>Back to awards</Button>
          </div>
        </Stack>
      );
    }

    return (
      <Card>
        <h2 className="mb-4 text-lg font-bold text-ink">
          {awardId === NEW_AWARD ? "New award" : "Edit award"}
        </h2>
        <Alert message={error} />
        <AwardForm
          api={api}
          initial={editing}
          games={games}
          busy={busy}
          onSubmit={save}
          onCancel={router.closeAward}
        />
      </Card>
    );
  }

  // --- List page: /awards ---------------------------------------------------

  return (
    <Stack>
      <PanelHeader
        title="Awards"
        action={<Button onClick={() => router.openAward(NEW_AWARD)}>+ New award</Button>}
      />

      <Alert message={error} />

      {awards === null ? (
        <Loading />
      ) : (
        <>
          <AwardFilters
            games={games}
            location={location}
            onChange={router.setFilters}
            onClear={router.clearFilters}
            filtered={router.filtered}
            shown={shown.length}
            total={awards.length}
          />

          {awards.length === 0 ? (
            <EmptyState>No awards yet. Create the first prize.</EmptyState>
          ) : shown.length === 0 ? (
            // Deliberately distinct from "no awards yet": prizes exist, the
            // filters hid them. Conflating the two sends an admin hunting for
            // data that is sitting right there behind a forgotten filter.
            <EmptyState>No awards match these filters.</EmptyState>
          ) : (
            <Stack gap="sm">
              {shown.map((a) => (
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
                    <Button variant="ghost" onClick={() => router.openAward(a.id)}>
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
        </>
      )}
    </Stack>
  );
}
