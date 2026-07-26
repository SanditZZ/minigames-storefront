-- The Thai description of a prize. See 005_award_name_th.sql for why award text
-- needs a column at all, why '' means "not translated" rather than "empty", and
-- why the pair is two files instead of one.

ALTER TABLE awards ADD COLUMN description_th TEXT NOT NULL DEFAULT '';
