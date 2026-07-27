CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE DEFAULT nextval('order_number_seq'),
  customer_name TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  subtotal INTEGER NOT NULL CHECK (subtotal >= 0),
  delivery_fee INTEGER CHECK (delivery_fee IS NULL OR delivery_fee >= 0),
  total INTEGER NOT NULL CHECK (total >= 0),
  status TEXT NOT NULL CHECK (status IN ('received', 'accepted', 'preparing', 'dispatched', 'rejected')),
  received_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  CONSTRAINT orders_total_matches_parts
    CHECK (total = subtotal + COALESCE(delivery_fee, 0))
);

CREATE TABLE IF NOT EXISTS order_items (
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_index INTEGER NOT NULL CHECK (item_index >= 0),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  line_total INTEGER NOT NULL CHECK (line_total = unit_price * quantity),
  PRIMARY KEY (order_id, item_index)
);

CREATE INDEX IF NOT EXISTS orders_received_at_idx
  ON orders (received_at DESC);

CREATE INDEX IF NOT EXISTS orders_status_received_at_idx
  ON orders (status, received_at DESC);
