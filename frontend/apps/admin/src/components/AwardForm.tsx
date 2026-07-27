import { useState } from "react";
import type { ApiClient, Award, AwardInput, Game } from "@minigames/api-client";
import { UNLIMITED_STOCK } from "@minigames/api-client";
import { ImageField } from "./ImageField";
import { Button, Checkbox, Field, Input, NumberInput, Select, Textarea } from "../ui";

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
  const [nameTh, setNameTh] = useState(initial?.nameTh ?? "");
  const [descriptionTh, setDescriptionTh] = useState(initial?.descriptionTh ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [gameSlug, setGameSlug] = useState(initial?.gameSlug ?? "");
  // number | null throughout: an empty box is a real state an operator passes
  // through while retyping, and coercing it to 0 here would propose a change
  // nobody made. `submit` is the one place a blank becomes a number.
  const [minScore, setMinScore] = useState<number | null>(initial?.minScore ?? 0);
  const [unlimited, setUnlimited] = useState((initial?.stock ?? UNLIMITED_STOCK) === UNLIMITED_STOCK);
  const [stock, setStock] = useState<number | null>(initial && initial.stock >= 0 ? initial.stock : 10);
  const [active, setActive] = useState(initial?.active ?? true);
  const [sortOrder, setSortOrder] = useState<number | null>(initial?.sortOrder ?? 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      nameTh: nameTh.trim(),
      descriptionTh: descriptionTh.trim(),
      imageUrl: imageUrl.trim(),
      gameSlug,
      minScore: minScore ?? 0,
      stock: unlimited ? UNLIMITED_STOCK : Math.max(0, stock ?? 0),
      active,
      sortOrder: sortOrder ?? 0,
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

      {/* Thai is OPTIONAL and says so, because a blank field here has to read as
          "this store does not need one" rather than as an unfinished form. The
          server falls back per field, so a prize with a Thai name and an English
          description is a supported half-way state and not a mistake — see
          internal/reward/text.go.

          Not required, deliberately: an English-only venue is a real
          configuration, and refusing to save a prize without a translation
          would make bilingual support a tax on the stores that do not want it.

          Labelled with the language's own name — someone looking for the Thai
          field scans for "ไทย", the same rule the player's language switcher
          follows. */}
      <Field label="Name — ไทย (optional)" className="sm:col-span-2">
        <Input
          value={nameTh}
          onChange={(e) => setNameTh(e.target.value)}
          maxLength={80}
          lang="th"
          placeholder="Leave empty to show the English name to Thai players"
        />
      </Field>

      <Field label="Description — ไทย (optional)" className="sm:col-span-2">
        <Textarea
          value={descriptionTh}
          onChange={(e) => setDescriptionTh(e.target.value)}
          rows={2}
          lang="th"
        />
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
        {/* No steppers: a score threshold is typed, not nudged from 0 to 40. */}
        <NumberInput label="Min score to win" bounds={{ min: 0, step: 1 }} value={minScore} onChange={setMinScore} />
      </Field>

      <Field label="Stock">
        <div className="flex items-center gap-3">
          <Checkbox label="Unlimited" checked={unlimited} onChange={setUnlimited} />
          {/* Steppers here: stock is the one field an operator really does move
              one at a time, and holding the button repeats. It cannot walk into
              UNLIMITED_STOCK's -1 — `min: 0` stops it, and unlimited stays the
              checkbox beside it. */}
          {!unlimited && (
            <NumberInput
              label="Stock"
              bounds={{ min: 0, step: 1 }}
              steppers
              value={stock}
              onChange={setStock}
              className="max-w-44"
            />
          )}
        </div>
      </Field>

      <Field label="Sort order">
        {/* Steppers: a sort order is almost always adjusted by one. */}
        <NumberInput label="Sort order" bounds={{ step: 1 }} steppers value={sortOrder} onChange={setSortOrder} />
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
