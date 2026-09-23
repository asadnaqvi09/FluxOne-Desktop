-- Catalog: categories, products, taxes
-- Used by: Sync (1.3), Catalog (1.5), Admin item rates (1.12)
-- Food-style categories set has_subcategories = 1 (items only after a sub is chosen).
-- Footwear-style categories set has_subcategories = 0 (items returned immediately).

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  has_subcategories INTEGER NOT NULL DEFAULT 0 CHECK (has_subcategories IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS subcategories (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  UNIQUE (category_id, name)
);

CREATE INDEX IF NOT EXISTS idx_subcategories_category
  ON subcategories (category_id);

CREATE TABLE IF NOT EXISTS tax_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  rate REAL NOT NULL CHECK (rate >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  barcode TEXT UNIQUE,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  subcategory_id TEXT REFERENCES subcategories(id),
  price REAL NOT NULL CHECK (price >= 0),
  discount REAL NOT NULL DEFAULT 0 CHECK (discount >= 0),
  stock INTEGER NOT NULL DEFAULT 0,
  is_popular INTEGER NOT NULL DEFAULT 0 CHECK (is_popular IN (0, 1)),
  image_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_category
  ON products (category_id, subcategory_id);

CREATE INDEX IF NOT EXISTS idx_products_sku
  ON products (sku);

CREATE INDEX IF NOT EXISTS idx_products_barcode
  ON products (barcode);

CREATE INDEX IF NOT EXISTS idx_products_popular
  ON products (is_popular);

CREATE TABLE IF NOT EXISTS product_taxes (
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tax_rule_id TEXT NOT NULL REFERENCES tax_rules(id),
  PRIMARY KEY (product_id, tax_rule_id)
);
