-- Manual queue position within a court (null = unordered, sorts last)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS queue_position int;

CREATE INDEX IF NOT EXISTS matches_court_queue
  ON matches (court_id, queue_position NULLS LAST)
  WHERE court_id IS NOT NULL;
