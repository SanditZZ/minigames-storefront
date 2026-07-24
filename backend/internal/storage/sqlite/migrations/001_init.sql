-- Schema for the SQLite backend. Kept intentionally simple and portable so the
-- same logical model maps cleanly onto a DynamoDB single-table design later:
--   games     -> PK: slug
--   sessions  -> PK: token (single-use permits, short TTL)
--   scores    -> PK: id, query by (game_slug, value) for leaderboards
--   awards    -> PK: id
--   settings  -> PK: key

CREATE TABLE IF NOT EXISTS games (
    slug        TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    score_unit  TEXT NOT NULL DEFAULT '',
    direction   TEXT NOT NULL DEFAULT 'higher',
    duration_ms INTEGER NOT NULL DEFAULT 5000,
    enabled     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,
    game_slug   TEXT NOT NULL,
    issued_at   TIMESTAMP NOT NULL,
    expires_at  TIMESTAMP NOT NULL,
    consumed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scores (
    id          TEXT PRIMARY KEY,
    game_slug   TEXT NOT NULL,
    player_name TEXT NOT NULL DEFAULT 'Guest',
    value       INTEGER NOT NULL,
    created_at  TIMESTAMP NOT NULL
);

-- Leaderboard access pattern: top scores for a game.
CREATE INDEX IF NOT EXISTS idx_scores_game_value ON scores (game_slug, value);

CREATE TABLE IF NOT EXISTS awards (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    image_url   TEXT NOT NULL DEFAULT '',
    game_slug   TEXT NOT NULL DEFAULT '',
    min_score   INTEGER NOT NULL DEFAULT 0,
    stock       INTEGER NOT NULL DEFAULT -1,
    active      INTEGER NOT NULL DEFAULT 1,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMP NOT NULL,
    updated_at  TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'string',
    description TEXT NOT NULL DEFAULT '',
    updated_at  TIMESTAMP NOT NULL
);
