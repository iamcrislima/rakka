-- Migration 016: Tournament creation refactor
-- Rename super8 → super, support up to 8 groups, add category gender/level/format fields

-- 1. Rename super8 → super in tournaments
ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_type_check;
UPDATE tournaments SET type = 'super' WHERE type = 'super8';
ALTER TABLE tournaments ADD CONSTRAINT tournaments_type_check
  CHECK (type IN ('super', 'doubles'));
ALTER TABLE tournaments ALTER COLUMN type SET DEFAULT 'super';

-- 2. Extend match stage check to support groups a–h (up to 32 players = 8 groups)
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_stage_check;
ALTER TABLE matches ADD CONSTRAINT matches_stage_check
  CHECK (stage IN (
    'group_a', 'group_b', 'group_c', 'group_d',
    'group_e', 'group_f', 'group_g', 'group_h',
    'final', 'consolation_final'
  ));

-- 3. Add new fields to categories
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'group_playoffs'
    CHECK (format IN ('round_robin', 'group_playoffs')),
  ADD COLUMN IF NOT EXISTS consolation_bracket boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gender text
    CHECK (gender IN ('mens', 'womens', 'mixed')),
  ADD COLUMN IF NOT EXISTS level text
    CHECK (level IN ('E', 'D', 'C', 'B', 'Open'));
