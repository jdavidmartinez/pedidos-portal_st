CREATE TABLE IF NOT EXISTS campaign_products (
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES menu_products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, product_id)
);

INSERT INTO campaign_products (campaign_id, product_id)
SELECT id, product_id
FROM campaigns
WHERE product_id IS NOT NULL
ON CONFLICT (campaign_id, product_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS campaign_products_product_id_idx
  ON campaign_products (product_id);
