ALTER TABLE order_edits
  ALTER COLUMN reason DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS order_edits_reason_check;

ALTER TABLE order_edits
  ADD CONSTRAINT order_edits_reason_check
  CHECK (reason IS NULL OR length(trim(reason)) >= 3);
