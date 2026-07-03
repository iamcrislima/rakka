-- ─────────────────────────────────────────────────────────────────────────
-- 011_categories.sql — Category system
-- Each tournament/event can hold multiple independent categories.
-- Each category has its own players, matches, status, and match rules.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE categories (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id uuid        NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  status        text        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','group_stage','finals','done')),
  max_games     int         NOT NULL DEFAULT 6,
  deuce         text        NOT NULL DEFAULT 'super_tiebreak',
  tiebreak_to   int         NOT NULL DEFAULT 10,
  sort_order    int         NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Foreign key from players → category (nullable for legacy tournaments)
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories(id) ON DELETE CASCADE;

-- Foreign key from matches → category (nullable for legacy tournaments)
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories(id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX ON categories (tournament_id, sort_order);
CREATE INDEX ON players    (category_id);
CREATE INDEX ON matches    (category_id, stage);

-- RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select" ON categories FOR SELECT USING (true);

CREATE POLICY "categories_insert" ON categories FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id
        AND (t.user_id = auth.uid() OR t.user_id IS NULL)
    )
  );

CREATE POLICY "categories_update" ON categories FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id
        AND (t.user_id = auth.uid() OR t.user_id IS NULL)
    )
  );

CREATE POLICY "categories_delete" ON categories FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id
        AND (t.user_id = auth.uid() OR t.user_id IS NULL)
    )
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE categories;
