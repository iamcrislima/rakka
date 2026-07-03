-- ──────────────────────────────────────────────────────────────────────────
-- 008_tv_content.sql  –  TV content rotation (idempotent)
-- ──────────────────────────────────────────────────────────────────────────

-- 1. Content items table
CREATE TABLE IF NOT EXISTS tv_content (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('image', 'promotion', 'announcement')),
  title         TEXT,
  body          TEXT,
  image_url     TEXT,
  duration      INT  NOT NULL DEFAULT 8,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. RLS
ALTER TABLE tv_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tv_content_select" ON tv_content;
CREATE POLICY "tv_content_select" ON tv_content
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "tv_content_insert" ON tv_content;
CREATE POLICY "tv_content_insert" ON tv_content
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE id = tournament_id
        AND (auth.uid() = user_id OR user_id IS NULL)
    )
  );

DROP POLICY IF EXISTS "tv_content_update" ON tv_content;
CREATE POLICY "tv_content_update" ON tv_content
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE id = tournament_id
        AND (auth.uid() = user_id OR user_id IS NULL)
    )
  );

DROP POLICY IF EXISTS "tv_content_delete" ON tv_content;
CREATE POLICY "tv_content_delete" ON tv_content
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE id = tournament_id
        AND (auth.uid() = user_id OR user_id IS NULL)
    )
  );

-- 3. Storage bucket
INSERT INTO storage.buckets (id, name, public)
  VALUES ('tv-content', 'tv-content', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "tv_content_storage_read"   ON storage.objects;
DROP POLICY IF EXISTS "tv_content_storage_write"  ON storage.objects;
DROP POLICY IF EXISTS "tv_content_storage_delete" ON storage.objects;

CREATE POLICY "tv_content_storage_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'tv-content');

CREATE POLICY "tv_content_storage_write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'tv-content');

CREATE POLICY "tv_content_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'tv-content');
