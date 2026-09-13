ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retention_hold_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retention_hold_reason TEXT;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_retention_hold_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_retention_hold_check CHECK (
    (retention_hold_until IS NULL AND retention_hold_reason IS NULL)
    OR (
      retention_hold_until IS NOT NULL
      AND retention_hold_reason IS NOT NULL
      AND length(trim(retention_hold_reason)) > 0
    )
  );

CREATE INDEX IF NOT EXISTS orders_retention_phone_received_idx
  ON orders (customer_phone, received_at DESC)
  WHERE anonymized_at IS NULL;

CREATE INDEX IF NOT EXISTS orders_anonymized_at_idx
  ON orders (anonymized_at)
  WHERE anonymized_at IS NOT NULL;

COMMENT ON COLUMN orders.retention_hold_until IS
  'Authorized retention exception. Use infinity for an indefinite legal hold.';

COMMENT ON COLUMN orders.retention_hold_reason IS
  'Non-personal reason code or case reference for the retention exception.';
