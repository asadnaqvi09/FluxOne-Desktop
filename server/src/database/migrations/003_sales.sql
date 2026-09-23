-- Sales: open tabs (survive lock), checkout, invoices, returns, exchanges
-- Used by: Cart (1.6), Checkout (1.7), Invoice (1.8), Return (1.9), Exchange (1.10)

CREATE TABLE IF NOT EXISTS sale_tabs (
  id TEXT PRIMARY KEY,
  till_session_id TEXT REFERENCES till_sessions(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  auth_session_id TEXT REFERENCES auth_sessions(id),
  tab_index INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'checked_out', 'void')),
  mode TEXT NOT NULL DEFAULT 'sale' CHECK (mode IN ('sale', 'exchange')),
  exchange_invoice_id TEXT,
  exchanged_credit REAL NOT NULL DEFAULT 0,
  exchanged_fingerprint TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sale_tabs_till
  ON sale_tabs (till_session_id, status);

CREATE INDEX IF NOT EXISTS idx_sale_tabs_employee
  ON sale_tabs (employee_id, status);

CREATE TABLE IF NOT EXISTS sale_tab_items (
  id TEXT PRIMARY KEY,
  tab_id TEXT NOT NULL REFERENCES sale_tabs(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1 CHECK (qty >= 0),
  unit_price REAL NOT NULL,
  discount REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sale_tab_items_tab
  ON sale_tab_items (tab_id);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  till_session_id TEXT REFERENCES till_sessions(id),
  employee_id TEXT REFERENCES employees(id),
  type TEXT NOT NULL CHECK (type IN ('Sale', 'Return', 'Exchange')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('Paid', 'Return', 'Adjust')),
  item_count INTEGER NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  tendered REAL NOT NULL DEFAULT 0,
  change_due REAL NOT NULL DEFAULT 0,
  net_due REAL NOT NULL DEFAULT 0,
  original_invoice_id TEXT REFERENCES invoices(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_created
  ON invoices (created_at);

CREATE INDEX IF NOT EXISTS idx_invoices_type
  ON invoices (type);

CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  discount REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL,
  is_returned INTEGER NOT NULL DEFAULT 0 CHECK (is_returned IN (0, 1)),
  original_item_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice
  ON invoice_items (invoice_id);

CREATE TABLE IF NOT EXISTS invoice_taxes (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tax_rule_id TEXT REFERENCES tax_rules(id),
  name TEXT NOT NULL,
  rate REAL NOT NULL,
  amount REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS exchange_events (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  tab_id TEXT REFERENCES sale_tabs(id),
  exchanged_fingerprint TEXT,
  replacement_fingerprint TEXT,
  exchanged_credit REAL NOT NULL DEFAULT 0,
  replacement_total REAL NOT NULL DEFAULT 0,
  net_due REAL NOT NULL DEFAULT 0,
  items_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_exchange_events_invoice
  ON exchange_events (invoice_id);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  qty_delta INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('sale', 'return', 'exchange', 'seed', 'adjust')),
  invoice_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product
  ON inventory_movements (product_id);
