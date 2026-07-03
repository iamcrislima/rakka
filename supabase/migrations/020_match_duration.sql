-- Match duration tracking — organizer taps "Iniciar partida" when play begins,
-- duration is computed on result confirmation.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS duration_seconds int;
