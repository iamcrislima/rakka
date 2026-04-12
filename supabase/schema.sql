-- ============================================================
-- Beach Tennis Manager — Database Schema
-- ============================================================

create extension if not exists "uuid-ossp";

-- Tournaments
create table tournaments (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  status      text not null default 'draft'
                check (status in ('draft','group_stage','finals','done')),
  created_at  timestamptz not null default now()
);

-- Players (8 per tournament, position 1-8)
create table players (
  id             uuid primary key default uuid_generate_v4(),
  tournament_id  uuid not null references tournaments(id) on delete cascade,
  name           text not null,
  position       int  not null check (position between 1 and 8),
  unique (tournament_id, position)
);

-- Matches
create table matches (
  id             uuid primary key default uuid_generate_v4(),
  tournament_id  uuid not null references tournaments(id) on delete cascade,
  stage          text not null
                   check (stage in ('group_a','group_b','sf','csf','final','consolation_final')),
  round          int  not null,          -- 1,2,3 in group; 1 in knockouts
  team1_p1       uuid not null references players(id),
  team1_p2       uuid not null references players(id),
  team2_p1       uuid not null references players(id),
  team2_p2       uuid not null references players(id),
  score1         int,                    -- games won by team 1
  score2         int,                    -- games won by team 2
  status         text not null default 'pending'
                   check (status in ('pending','done')),
  created_at     timestamptz not null default now()
);

-- Enable realtime
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table tournaments;

-- ── Indexes ────────────────────────────────────────────────
create index on players    (tournament_id);
create index on matches    (tournament_id, stage);
