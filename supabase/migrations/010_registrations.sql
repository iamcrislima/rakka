-- ─────────────────────────────────────────────────────────────────────────
-- 010_registrations.sql — Tournament registration system
-- ─────────────────────────────────────────────────────────────────────────

-- Registration sessions (one per event / organizer)
CREATE TABLE registrations (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  share_token  text        NOT NULL UNIQUE
                             DEFAULT substring(md5(random()::text || clock_timestamp()::text), 1, 12),
  name         text        NOT NULL,
  player_limit int         NOT NULL DEFAULT 8 CHECK (player_limit >= 2),
  is_open      bool        NOT NULL DEFAULT true,
  user_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Players who signed up (confirmed or waiting)
CREATE TABLE registrants (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_id uuid        NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  status          text        NOT NULL DEFAULT 'confirmed'
                                CHECK (status IN ('confirmed', 'waiting')),
  joined_at       timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX ON registrations (share_token);
CREATE INDEX ON registrations (user_id);
CREATE INDEX ON registrants   (registration_id, status, joined_at);

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrants   ENABLE ROW LEVEL SECURITY;

-- registrations: anyone can read (needed for public share links)
CREATE POLICY "registrations_select"
  ON registrations FOR SELECT USING (true);

-- only authenticated owners can insert
CREATE POLICY "registrations_insert"
  ON registrations FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- only owner can update/delete
CREATE POLICY "registrations_update"
  ON registrations FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "registrations_delete"
  ON registrations FOR DELETE
  USING (auth.uid() = user_id OR user_id IS NULL);

-- registrants: anyone can read
CREATE POLICY "registrants_select"
  ON registrants FOR SELECT USING (true);

-- anyone can insert (public sign-up)
CREATE POLICY "registrants_insert"
  ON registrants FOR INSERT WITH CHECK (true);

-- only the registration owner can delete registrants
CREATE POLICY "registrants_delete"
  ON registrants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM registrations r
      WHERE r.id = registration_id
        AND (r.user_id = auth.uid() OR r.user_id IS NULL)
    )
  );

-- Realtime for live updates on the public join page
ALTER PUBLICATION supabase_realtime ADD TABLE registrants;
ALTER PUBLICATION supabase_realtime ADD TABLE registrations;
