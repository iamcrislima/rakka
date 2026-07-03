-- Add 'super_tiebreak' to allowed deuce values
-- and update default to match Beach Tennis preset

alter table tournaments
  drop constraint if exists tournaments_deuce_check;

alter table tournaments
  add constraint tournaments_deuce_check
    check (deuce in ('continue', 'tiebreak', 'super_tiebreak'));

alter table tournaments
  alter column deuce set default 'super_tiebreak';

-- Migrate existing rows that used 'tiebreak' → 'super_tiebreak' (beach tennis standard)
update tournaments
set deuce = 'super_tiebreak'
where deuce = 'tiebreak';
