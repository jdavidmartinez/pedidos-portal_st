ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS variant TEXT NOT NULL DEFAULT 'individual'
  CHECK (variant IN ('individual', 'combo'));
