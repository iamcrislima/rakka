-- Player check-in — public QR-code driven attendance confirmation shown on
-- the TV welcome screen (/t/[id]/tv) before a tournament starts. Same
-- loose-RLS posture as players/matches (no RLS — gated at the route level).
ALTER TABLE players ADD COLUMN IF NOT EXISTS checked_in boolean NOT NULL DEFAULT false;
ALTER TABLE players ADD COLUMN IF NOT EXISTS checked_in_at timestamptz;

ALTER PUBLICATION supabase_realtime ADD TABLE players;
