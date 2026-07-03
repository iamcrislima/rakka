-- Migration 018: fix players_category_position_key from 017
--
-- Super Oito Misto intentionally reuses position 1-8 for men AND 1-8 for
-- women within the SAME category (position identifies "man i" / "woman i"
-- for the partner-rotation formula, not a global seat number). The
-- (category_id, position) constraint added in 017 didn't account for
-- that and rejects the very first insert (man #1 and woman #1 both at
-- position 1 in the same category). Rescope to (category_id, gender, position).

ALTER TABLE players DROP CONSTRAINT IF EXISTS players_category_position_key;
ALTER TABLE players ADD CONSTRAINT players_category_gender_position_key
  UNIQUE (category_id, gender, position);
