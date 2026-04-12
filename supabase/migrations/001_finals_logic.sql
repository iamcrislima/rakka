-- Migration 001: update finals logic
-- Drop old check (sf/csf removed), replace with final/consolation_final only.

alter table matches drop constraint if exists matches_stage_check;

alter table matches
  add constraint matches_stage_check
  check (stage in ('group_a','group_b','final','consolation_final'));
