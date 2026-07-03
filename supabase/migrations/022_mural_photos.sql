-- Event photo mural — public, unauthenticated uploads that sit in a
-- moderation queue until an organizer approves them. Nothing goes on the
-- TV screen without passing through /admin/tournaments/[id]/mural/moderar.
CREATE TABLE mural_photos (
  id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id  uuid        NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  storage_path   text        NOT NULL,
  status         text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  moderated_at   timestamptz
);

CREATE INDEX ON mural_photos (tournament_id, status, created_at);

-- Same loose-RLS posture as the rest of the app (matches/players etc. have
-- no RLS at all — access is gated at the route/middleware level, not the
-- table level). Public can read/insert (upload -> pending), and update is
-- needed for the anon-key moderation flow through the /admin gate.
ALTER TABLE mural_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mural_photos_select" ON mural_photos FOR SELECT USING (true);
CREATE POLICY "mural_photos_insert" ON mural_photos FOR INSERT WITH CHECK (true);
CREATE POLICY "mural_photos_update" ON mural_photos FOR UPDATE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE mural_photos;

-- Storage bucket for the actual image files, public read (so the TV screen
-- and moderation preview can load them directly via public URL).
INSERT INTO storage.buckets (id, name, public)
VALUES ('mural-photos', 'mural-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "mural_photos_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'mural-photos');

CREATE POLICY "mural_photos_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'mural-photos');
