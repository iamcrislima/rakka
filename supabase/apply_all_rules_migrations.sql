-- ============================================================
-- Apply all match-rules migrations (safe to run multiple times)
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add rules columns (if they don't exist yet)
alter table tournaments
  add column if not exists max_games   int  not null default 6,
  add column if not exists tiebreak_to int  not null default 7,
  add column if not exists deuce       text not null default 'super_tiebreak';

-- 2. Drop starting_score if it exists
alter table tournaments
  drop column if exists starting_score;

-- 3. Enforce max_games values
alter table tournaments
  drop constraint if exists tournaments_max_games_check;
alter table tournaments
  add constraint tournaments_max_games_check
    check (max_games in (4, 6));

-- 4. Enforce deuce values (tiebreak or super_tiebreak only)
alter table tournaments
  drop constraint if exists tournaments_deuce_check;
alter table tournaments
  add constraint tournaments_deuce_check
    check (deuce in ('tiebreak', 'super_tiebreak'));

-- 5. Migrate any old deuce values
update tournaments set deuce = 'super_tiebreak' where deuce not in ('tiebreak', 'super_tiebreak');

-- 6. Enforce tiebreak_to values
alter table tournaments
  drop constraint if exists tournaments_tiebreak_to_check;
alter table tournaments
  add constraint tournaments_tiebreak_to_check
    check (tiebreak_to in (7, 10));

-- Done
select 'Migrations applied successfully' as result;
