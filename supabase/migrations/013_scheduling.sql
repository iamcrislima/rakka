-- ─────────────────────────────────────────────────────────────────────────
-- 013_scheduling.sql — Category scheduling + match override
-- ─────────────────────────────────────────────────────────────────────────

-- When a category is scheduled to start (null = starts immediately)
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

-- Organizer can manually activate a specific match before its category starts
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS override_active boolean NOT NULL DEFAULT false;

-- Index for quickly finding active matches per category
CREATE INDEX IF NOT EXISTS matches_override ON matches (override_active) WHERE override_active = true;
