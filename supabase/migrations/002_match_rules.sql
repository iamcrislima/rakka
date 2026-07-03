-- Add match rules columns to tournaments
-- Defaults correspond to the "Beach Tennis" preset

alter table tournaments
  add column if not exists starting_score int  not null default 0
    check (starting_score in (0, 2, 4)),
  add column if not exists max_games      int  not null default 6
    check (max_games in (4, 6)),
  add column if not exists deuce          text not null default 'tiebreak'
    check (deuce in ('continue', 'tiebreak')),
  add column if not exists tiebreak_to    int  not null default 10
    check (tiebreak_to in (7, 10));
