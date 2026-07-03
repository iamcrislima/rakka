-- ──────────────────────────────────────────────────────────────────────────
-- 007_leagues.sql  –  League system (idempotent)
-- ──────────────────────────────────────────────────────────────────────────

-- Drop existing policies safely (tables may not exist yet)
DO $$ BEGIN
  DROP POLICY IF EXISTS "leagues_select"        ON leagues;
  DROP POLICY IF EXISTS "leagues_insert"        ON leagues;
  DROP POLICY IF EXISTS "leagues_update"        ON leagues;
  DROP POLICY IF EXISTS "leagues_delete"        ON leagues;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "league_stages_select"  ON league_stages;
  DROP POLICY IF EXISTS "league_stages_insert"  ON league_stages;
  DROP POLICY IF EXISTS "league_stages_delete"  ON league_stages;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 1. Leagues
CREATE TABLE IF NOT EXISTS leagues (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  scoring      JSONB NOT NULL DEFAULT '{"1":10,"2":7,"3":5,"4":3,"5":2,"7":1}',
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. League stages
CREATE TABLE IF NOT EXISTS league_stages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id     UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  stage_number  INT  NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (league_id, tournament_id),
  UNIQUE (league_id, stage_number)
);

-- 3. RLS – Leagues
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leagues_select" ON leagues FOR SELECT USING (true);
CREATE POLICY "leagues_insert" ON leagues FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "leagues_update" ON leagues FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "leagues_delete" ON leagues FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);

-- 4. RLS – League stages
ALTER TABLE league_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "league_stages_select" ON league_stages FOR SELECT USING (true);

CREATE POLICY "league_stages_insert" ON league_stages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE id = league_id
        AND (auth.uid() = user_id OR user_id IS NULL)
    )
  );

CREATE POLICY "league_stages_delete" ON league_stages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE id = league_id
        AND (auth.uid() = user_id OR user_id IS NULL)
    )
  );
