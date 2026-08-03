ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS product_id TEXT REFERENCES menu_products(id) ON DELETE SET NULL;

UPDATE campaigns
SET active = FALSE, updated_at = now()
WHERE product_id IS NULL AND active = TRUE;

CREATE INDEX IF NOT EXISTS campaigns_product_id_idx ON campaigns (product_id);
