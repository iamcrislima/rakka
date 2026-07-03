-- ─────────────────────────────────────────────────────────────────────────
-- 019_sum_of_games.sql — Explicit "Soma de Games" rule type
--
-- Replaces the implicit "Clássico preset combo == sum-to-7" detection
-- (lib/match-rules.ts's old isSumToSevenFormat) with an explicit rule_type
-- column. sum_of_games matches end the instant s1 + s2 === target_sum —
-- no advantage, no tiebreak, unrelated to max_games/deuce/tiebreak_to.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS rule_type  text NOT NULL DEFAULT 'standard'
    CHECK (rule_type IN ('standard', 'sum_of_games')),
  ADD COLUMN IF NOT EXISTS target_sum int
    CHECK (target_sum IS NULL OR target_sum > 0);

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS rule_type  text NOT NULL DEFAULT 'standard'
    CHECK (rule_type IN ('standard', 'sum_of_games')),
  ADD COLUMN IF NOT EXISTS target_sum int
    CHECK (target_sum IS NULL OR target_sum > 0);

-- Migrate rows that were created under the "Clássico" preset (max_games=6,
-- deuce='super_tiebreak', tiebreak_to=7) — that exact combo was silently
-- being validated as sum-to-7 by the old isSumToSevenFormat() workaround,
-- so make that behavior explicit instead of reinterpreting it as real
-- win-by-2/tiebreak logic (which would invalidate already-recorded scores).
UPDATE categories
   SET rule_type = 'sum_of_games', target_sum = 7
 WHERE max_games = 6 AND deuce = 'super_tiebreak' AND tiebreak_to = 7;

UPDATE tournaments
   SET rule_type = 'sum_of_games', target_sum = 7
 WHERE max_games = 6 AND deuce = 'super_tiebreak' AND tiebreak_to = 7;
