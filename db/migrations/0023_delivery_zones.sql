ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_zone TEXT;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_delivery_zone_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_delivery_zone_check CHECK (
    delivery_zone IS NULL
    OR delivery_zone IN ('zone_1', 'zone_2', 'zone_3', 'zone_4')
  );

COMMENT ON COLUMN orders.delivery_zone IS
  'Kitchen-assigned delivery zone. Customer ordering does not set this value.';
