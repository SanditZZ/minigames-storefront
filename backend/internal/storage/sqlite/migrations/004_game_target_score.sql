-- The house benchmark a game's score reveal is measured against: the value at
-- which the meter tower reads full.
--
-- Before this column the tower was scaled against the current leaderboard
-- leader, which made the board its own denominator. That is merely flattering
-- on an empty board (the first player is told they broke the record) and
-- genuinely broken on a lower-is-better game whose scores can reach 0 — the
-- meter's "best <= 0" guard then fills the tower for every later player, for
-- good. Precision Stop is exactly such a game, so the two shipped together.
--
-- DEFAULT 0 means "unset, fall back to the leaderboard": harmless for a row
-- written by an older build, and never reached in practice because Seed
-- upserts the in-code catalog on every boot and a Go test asserts every
-- registered game declares a positive benchmark.
--
-- SQLite has no "ADD COLUMN IF NOT EXISTS", so this file is applied
-- conditionally by Store.Migrate (it checks pragma table_info first), which is
-- what keeps migration idempotent across restarts.

ALTER TABLE games ADD COLUMN target_score INTEGER NOT NULL DEFAULT 0;
