-- Align constraints with final rule set:
--   starting_score: 0 or 2 only (remove 4)
--   deuce: 'tiebreak' or 'super_tiebreak' only (remove 'continue')
--   default deuce → 'super_tiebreak' (Beach Tennis)
--   default starting_score → 0
--   default tiebreak_to → 7

-- deuce constraint
alter table tournaments drop constraint if exists tournaments_deuce_check;
alter table tournaments add constraint tournaments_deuce_check
  check (deuce in ('tiebreak', 'super_tiebreak'));

-- Migrate removed deuce values
update tournaments set deuce = 'super_tiebreak' where deuce = 'continue';

-- starting_score constraint (drop old, add new)
alter table tournaments drop constraint if exists tournaments_starting_score_check;
alter table tournaments add constraint tournaments_starting_score_check
  check (starting_score in (0, 2));

-- Fix any rows with starting_score=4 → 2
update tournaments set starting_score = 2 where starting_score = 4;

-- Update defaults
alter table tournaments alter column deuce          set default 'super_tiebreak';
alter table tournaments alter column starting_score set default 0;
alter table tournaments alter column tiebreak_to    set default 7;
