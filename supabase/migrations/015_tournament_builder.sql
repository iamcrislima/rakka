-- Tournament format type
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'super8'
  CHECK (type IN ('super8', 'doubles'));

-- Category enhancements
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS player_limit  int  NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS entry_mode    text NOT NULL DEFAULT 'manual'
    CHECK (entry_mode IN ('manual', 'registration')),
  ADD COLUMN IF NOT EXISTS price         numeric(10,2),
  ADD COLUMN IF NOT EXISTS payment_mode  text
    CHECK (payment_mode IN ('individual', 'pair')),
  ADD COLUMN IF NOT EXISTS registration_id uuid
    REFERENCES registrations(id) ON DELETE SET NULL;

-- Registrant enhancements
ALTER TABLE registrants
  ADD COLUMN IF NOT EXISTS partner_name   text,
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'waived'));

CREATE INDEX IF NOT EXISTS categories_registration ON categories (registration_id)
  WHERE registration_id IS NOT NULL;
