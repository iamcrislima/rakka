-- ──────────────────────────────────────────────────────────────────────────
-- 009_tv_frequency.sql  –  Add frequency column to tv_content (idempotent)
-- ──────────────────────────────────────────────────────────────────────────

-- frequency = minutes between fullscreen appearances (null = use old lower-third behavior)
ALTER TABLE tv_content
  ADD COLUMN IF NOT EXISTS frequency INT DEFAULT 5;
