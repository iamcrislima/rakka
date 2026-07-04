-- Minimal IP+action rate limiting for public, unauthenticated surfaces
-- (mural upload, check-in, lançar resultado). Not meant to be
-- sophisticated — just enough to blunt accidental request spam during a
-- live event. Same loose-RLS posture as most of the app: no RLS, gated by
-- application logic only.
CREATE TABLE rate_limit_hits (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  action     text        NOT NULL,
  ip_key     text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON rate_limit_hits (action, ip_key, created_at);
