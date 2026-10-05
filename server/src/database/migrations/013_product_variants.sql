-- Cloud enriched catalog: variants + bundles + sync cursor / branch lock
-- Additive only — safe for existing installs.

ALTER TABLE products ADD COLUMN product_type TEXT NOT NULL DEFAULT 'single';
ALTER TABLE products ADD COLUMN parent_id TEXT REFERENCES products(id);
ALTER TABLE products ADD COLUMN variant_label TEXT;
ALTER TABLE products ADD COLUMN variant_options TEXT NOT NULL DEFAULT '[]';
ALTER TABLE products ADD COLUMN bundle_items TEXT NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_products_parent
  ON products (parent_id);

CREATE INDEX IF NOT EXISTS idx_products_type_active
  ON products (product_type, is_active);

ALTER TABLE sync_meta ADD COLUMN sync_version TEXT;
ALTER TABLE sync_meta ADD COLUMN branch_status TEXT NOT NULL DEFAULT 'open';
