CREATE TABLE IF NOT EXISTS order_edits (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reason TEXT CHECK (reason IS NULL OR length(trim(reason)) >= 3),
  previous_order JSONB NOT NULL,
  updated_order JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE order_edits
  ALTER COLUMN reason DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS order_edits_reason_check;

ALTER TABLE order_edits
  ADD CONSTRAINT order_edits_reason_check
  CHECK (reason IS NULL OR length(trim(reason)) >= 3);

CREATE INDEX IF NOT EXISTS order_edits_order_id_created_at_idx
  ON order_edits (order_id, created_at DESC);
