import { useState } from "react";
import type { Award, AwardInput, Game } from "@minigames/api-client";
import { UNLIMITED_STOCK } from "@minigames/api-client";
import { Button, Field, Input, Select, Textarea } from "../ui";

interface Props {
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
export function AwardForm({ initial, games, busy, onSubmit, onCancel }: Props) {
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

      <Field label="Image URL" className="sm:col-span-2">
        <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
      </Field>

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
          <label className="flex items-center gap-2 text-sm text-ink/70">
            <input type="checkbox" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} />
            Unlimited
          </label>
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

      <div className="flex items-center gap-2 sm:col-span-2">
        <input id="active" type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        <label htmlFor="active" className="text-sm text-ink/80">
          Active (eligible to be awarded)
        </label>
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
