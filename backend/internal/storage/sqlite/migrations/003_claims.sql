-- Prize claims: the redeemable credential a winning round earns.
--
-- A separate table rather than columns on `scores` because the two have
-- different lifetimes. A score is an immutable result — written once, never
-- edited. A claim is a credential that moves through states (issued → redeemed,
-- or issued → expired) and is the thing an admin acts on at a counter.
--
-- There is NO status column, deliberately. issued/redeemed/expired is derived
-- from (redeemed_at, expires_at, now) by internal/claim.StatusAt. Storing it
-- too would mean two answers that disagree the moment a claim expires without
-- anyone writing a row — nothing runs at the instant of expiry to update it.
--
-- award_name is a SNAPSHOT, not a join. Deleting an award must not rewrite what
-- a permanent result URL says was won: app.Service.awardByID degrades a deleted
-- award to "no prize", so without this copy a page reading "You won a Coffee"
-- would start reading "no prize this time".
--
-- Applied by Store.Migrate on every boot; IF NOT EXISTS throughout makes that
-- idempotent, the same way the base schema is.

CREATE TABLE IF NOT EXISTS claims (
    id          TEXT PRIMARY KEY,
    -- UNIQUE is the real defence against a code collision. The generator's ~39
    -- bits make one unlikely, not impossible, so the writer retries on conflict.
    code        TEXT NOT NULL UNIQUE,
    score_id    TEXT NOT NULL,
    award_id    TEXT NOT NULL,
    award_name  TEXT NOT NULL,
    issued_at   TIMESTAMP NOT NULL,
    -- NULL means "never expires" (an admin set the TTL to zero), which is why
    -- this is nullable rather than carrying a far-future sentinel date.
    expires_at  TIMESTAMP,
    redeemed_at TIMESTAMP
);

-- Access pattern: a result URL resolving the claim its round earned.
CREATE INDEX IF NOT EXISTS idx_claims_score ON claims (score_id);

-- Access pattern: the admin list, newest first.
CREATE INDEX IF NOT EXISTS idx_claims_issued ON claims (issued_at);
