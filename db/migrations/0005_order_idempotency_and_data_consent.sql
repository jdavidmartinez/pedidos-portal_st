ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS data_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_consent_version TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_uq
  ON orders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

