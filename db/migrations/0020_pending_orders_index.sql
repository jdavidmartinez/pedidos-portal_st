CREATE INDEX IF NOT EXISTS idx_orders_pending_received_at
  ON orders (received_at ASC)
  WHERE status IN ('received', 'accepted', 'preparing');
