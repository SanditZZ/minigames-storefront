import { useState } from "react";
import type { ApiClient, Award, AwardInput, Game } from "@minigames/api-client";
import { UNLIMITED_STOCK } from "@minigames/api-client";
import { ImageField } from "./ImageField";
import { Button, Checkbox, Field, Input, Select, Textarea } from "../ui";

interface Props {
  api: ApiClient;
  initial?: Award;
  games: Game[];
  busy: boolean;
  onSubmit: (input: AwardInput) => void;
  onCancel: () => void;
}

/**
 * Create/edit form for an award, built entirely from the shared admin kit so it
 * matches every other panel. Light client-side guards only — the backend
 * re-validates. "Unlimited stock" toggles the sentinel value the API expects.
 */
export function AwardForm({ api, initial, games, busy, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [gameSlug, setGameSlug] = useState(initial?.gameSlug ?? "");
  const [minScore, setMinScore] = useState(initial?.minScore ?? 0);
  const [unlimited, setUnlimited] = useState((initial?.stock ?? UNLIMITED_STOCK) === UNLIMITED_STOCK);
  const [stock, setStock] = useState(initial && initial.stock >= 0 ? initial.stock : 10);
  const [active, setActive] = useState(initial?.active ?? true);
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      imageUrl: imageUrl.trim(),
      gameSlug,
      minScore,
      stock: unlimited ? UNLIMITED_STOCK : Math.max(0, stock),
      active,
      sortOrder,
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Name" className="sm:col-span-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
      </Field>

      <Field label="Description" className="sm:col-span-2">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </Field>

      <div className="sm:col-span-2">
        <ImageField
          api={api}
          label="Image"
          value={imageUrl}
          onChange={setImageUrl}
          // Square, because PrizeImage renders into a square box with
          // `object-cover` — cropping here is the operator choosing what the
          // browser would otherwise trim on their behalf.
          output={{ width: 600, height: 600 }}
          hint="Shown in the prize showcase before a round and on the winner's result screen."
        />
      </div>

      <Field label="Game">
        <Select value={gameSlug} onChange={(e) => setGameSlug(e.target.value)}>
          <option value="">Any game</option>
          {games.map((g) => (
            <option key={g.slug} value={g.slug}>
              {g.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Min score to win">
        <Input type="number" value={minScore} min={0} onChange={(e) => setMinScore(Number(e.target.value))} />
      </Field>

      <Field label="Stock">
        <div className="flex items-center gap-3">
          <Checkbox label="Unlimited" checked={unlimited} onChange={setUnlimited} />
          {!unlimited && (
            <Input
              type="number"
              value={stock}
              min={0}
              onChange={(e) => setStock(Number(e.target.value))}
              className="max-w-28"
            />
          )}
        </div>
      </Field>

      <Field label="Sort order">
        <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
      </Field>

      <div className="sm:col-span-2">
        <Checkbox label="Active (eligible to be awarded)" checked={active} onChange={setActive} />
      </div>

      <div className="flex justify-end gap-3 sm:col-span-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save award"}
        </Button>
      </div>
    </form>
  );
}
