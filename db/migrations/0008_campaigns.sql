CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 0 AND 100),
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT campaigns_date_range CHECK (ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS campaigns_active_dates_idx
  ON campaigns (active, starts_on, ends_on);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_name TEXT,
  ADD COLUMN IF NOT EXISTS discount_percent INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS discount_amount INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount >= 0);

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_total_matches_parts;

ALTER TABLE orders
  ADD CONSTRAINT orders_total_matches_parts
  CHECK (total = subtotal - discount_amount + COALESCE(delivery_fee, 0));

CREATE INDEX IF NOT EXISTS orders_campaign_id_idx ON orders (campaign_id);
