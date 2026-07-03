-- Unguessable per-court token for the public "self-service" score-entry
-- screen (/t/[tournamentId]/quadra/[token]). Never sequential/guessable —
-- generated as a random uuid, distinct from the court's own id so rotating
-- it (if a QR code leaks) doesn't require deleting/recreating the court.
ALTER TABLE courts ADD COLUMN IF NOT EXISTS token uuid NOT NULL DEFAULT uuid_generate_v4();
CREATE UNIQUE INDEX IF NOT EXISTS courts_token_idx ON courts (token);
