-- ─────────────────────────────────────────────────────────────────────────
-- 012_courts.sql — Court management
-- Courts belong to a tournament. Each match can be assigned to one court.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE courts (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id uuid        NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  sort_order    int         NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Each match can be assigned to a court
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS court_id uuid REFERENCES courts(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX ON courts  (tournament_id, sort_order);
CREATE INDEX ON matches (court_id);

-- RLS
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "courts_select" ON courts FOR SELECT USING (true);

CREATE POLICY "courts_insert" ON courts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id
        AND (t.user_id = auth.uid() OR t.user_id IS NULL)
    )
  );

CREATE POLICY "courts_update" ON courts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id
        AND (t.user_id = auth.uid() OR t.user_id IS NULL)
    )
  );

CREATE POLICY "courts_delete" ON courts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id
        AND (t.user_id = auth.uid() OR t.user_id IS NULL)
    )
  );

-- Realtime (court assignments update the TV display)
ALTER PUBLICATION supabase_realtime ADD TABLE courts;
