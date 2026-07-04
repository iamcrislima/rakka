-- Configurable interval (minutes) used to stagger the PREDICTED start time of
-- each round after the first, before any real match duration data exists.
-- Round 1 always starts at categories.scheduled_at; later rounds are then
-- re-estimated using the actual average duration of completed rounds
-- (see lib/round-schedule.ts) instead of this fixed value.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS round_interval_minutes int NOT NULL DEFAULT 30;
