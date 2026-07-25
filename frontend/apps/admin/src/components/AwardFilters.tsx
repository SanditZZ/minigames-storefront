import type { Game } from "@minigames/api-client";
import type { FilterPatch, Location } from "../router";
import { Button, Card, Input, Select } from "../ui";

interface Props {
  games: Game[];
  location: Location;
  onChange: (patch: FilterPatch) => void;
  onClear: () => void;
  /** True when something is narrowing the list — shows the clear affordance. */
  filtered: boolean;
  /** Counts for the result summary. */
  shown: number;
  total: number;
}

/**
 * The awards list's filter bar.
 *
 * Every control is bound to the URL rather than local state, so a filtered view
 * is bookmarkable and survives a reload — and the summary line underneath is
 * the honest answer to "why am I only seeing two prizes?", which is the failure
 * mode of a filter bar an admin has forgotten they set.
 *
 * Wraps on narrow screens: each control has a minimum width and the row is a
 * flex-wrap, so nothing is squeezed to an unusable size on a phone.
 */
export function AwardFilters({ games, location, onChange, onClear, filtered, shown, total }: Props) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[10rem] flex-1">
          <span className="mb-1 block text-xs font-semibold text-ink/60">Search</span>
          <Input
            type="search"
            value={location.query}
            onChange={(e) => onChange({ query: e.target.value })}
            placeholder="Prize name…"
            aria-label="Search awards by name"
          />
        </label>

        <label className="min-w-[9rem] flex-1">
          <span className="mb-1 block text-xs font-semibold text-ink/60">Game</span>
          <Select
            value={location.gameSlug}
            onChange={(e) => onChange({ gameSlug: e.target.value })}
            aria-label="Filter by game"
          >
            <option value="">All games</option>
            {games.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.name}
              </option>
            ))}
          </Select>
        </label>

        <label className="min-w-[8rem] flex-1">
          <span className="mb-1 block text-xs font-semibold text-ink/60">Status</span>
          <Select
            value={location.status}
            onChange={(e) => onChange({ status: e.target.value as Location["status"] })}
            aria-label="Filter by status"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </label>

        <label className="min-w-[8rem] flex-1">
          <span className="mb-1 block text-xs font-semibold text-ink/60">Stock</span>
          <Select
            value={location.stock}
            onChange={(e) => onChange({ stock: e.target.value as Location["stock"] })}
            aria-label="Filter by stock"
          >
            <option value="all">All</option>
            <option value="in">In stock</option>
            <option value="out">Sold out</option>
            <option value="unlimited">Unlimited</option>
          </Select>
        </label>

        <label className="min-w-[9rem] flex-1">
          <span className="mb-1 block text-xs font-semibold text-ink/60">Sort by</span>
          <Select
            value={location.sort}
            onChange={(e) => onChange({ sort: e.target.value as Location["sort"] })}
            aria-label="Sort awards"
          >
            <option value="order">Configured order</option>
            <option value="name">Name</option>
            <option value="threshold">Threshold</option>
            <option value="stock">Stock</option>
          </Select>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-ink/60" role="status">
          {shown === total ? `${total} award${total === 1 ? "" : "s"}` : `${shown} of ${total} awards`}
        </p>
        {filtered && (
          <Button variant="ghost" className="shrink-0 whitespace-nowrap" onClick={onClear}>
            Clear filters
          </Button>
        )}
      </div>
    </Card>
  );
}
