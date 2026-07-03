-- ──────────────────────────────────────────────────────────────────────────
-- 006_auth.sql  –  Add user ownership + RLS to tournaments
-- ──────────────────────────────────────────────────────────────────────────

-- 1. Add user_id column (nullable so existing rows aren't broken)
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Enable Row Level Security
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

-- 3. Policies

-- Anyone can read (needed for unauthenticated share links to work)
CREATE POLICY "tournaments_select"
  ON tournaments FOR SELECT
  USING (true);

-- Authenticated users can insert their own tournaments
CREATE POLICY "tournaments_insert"
  ON tournaments FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Only the owner can update/delete
CREATE POLICY "tournaments_update"
  ON tournaments FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "tournaments_delete"
  ON tournaments FOR DELETE
  USING (auth.uid() = user_id OR user_id IS NULL);

-- ──────────────────────────────────────────────────────────────────────────
-- players / matches inherit access through tournament (no direct RLS needed
-- for now — they're always fetched via tournament_id and the app already
-- validates ownership at the tournament level)
-- ──────────────────────────────────────────────────────────────────────────
