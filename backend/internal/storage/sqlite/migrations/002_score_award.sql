-- Link a score to the prize it actually won, so a finished round can be
-- re-read later (GET /api/v1/games/{slug}/scores/{id}) and still report the
-- award that was granted at play time — not one re-derived from today's
-- thresholds and stock levels.
--
-- SQLite has no "ADD COLUMN IF NOT EXISTS", so this file is applied
-- conditionally by Store.Migrate (it checks pragma table_info first), keeping
-- migration idempotent across restarts.

ALTER TABLE scores ADD COLUMN award_id TEXT NOT NULL DEFAULT '';
