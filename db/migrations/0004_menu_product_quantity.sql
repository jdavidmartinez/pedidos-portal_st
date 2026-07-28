ALTER TABLE menu_products
  ADD COLUMN IF NOT EXISTS available_quantity INTEGER
  CHECK (available_quantity IS NULL OR available_quantity >= 0);
