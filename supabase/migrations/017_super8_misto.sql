-- Migration 017: Super Oito Misto — mixed-doubles rotating-partner format
-- Adds per-player gender (needed to pair 1 man + 1 woman every round) and
-- a new categories.format value. Match/finish resolution reuses the
-- existing matches table shape unchanged — no schema change needed there.

-- 1. Gender per player (backfill existing rows as 'M' — legacy tournaments
--    never used gender, so the value is a harmless placeholder for them).
ALTER TABLE players ADD COLUMN IF NOT EXISTS gender text;
UPDATE players SET gender = 'M' WHERE gender IS NULL;
ALTER TABLE players ALTER COLUMN gender SET NOT NULL;
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_gender_check;
ALTER TABLE players ADD CONSTRAINT players_gender_check CHECK (gender IN ('M', 'F'));

-- 2. Drop the legacy position <= 8 constraint if it's still present.
--    Categories already support up to 32 players (group_playoffs); Super
--    Oito Misto needs positions 1-16 (8 men + 8 women).
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_position_check;

-- 2b. The original schema uniqued position per-TOURNAMENT, from before
--     categories existed. Two categories in the same tournament both
--     wanting position 1 would collide. Rescope to per-category (NULL
--     category_id rows — legacy, category-less tournaments — stay
--     distinct from each other under NULL semantics, so this is safe).
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_tournament_id_position_key;
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_category_position_key;
ALTER TABLE players ADD CONSTRAINT players_category_position_key UNIQUE (category_id, position);

-- 3. New category format value.
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_format_check;
ALTER TABLE categories ADD CONSTRAINT categories_format_check
  CHECK (format IN ('round_robin', 'group_playoffs', 'super8_misto'));
