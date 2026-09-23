-- Invoice history + exchange-tab metadata (Phase 1.8–1.10)
-- Used by: Invoice list/print, Return, Exchange start/checkout

CREATE TABLE IF NOT EXISTS invoice_history (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES employees(id),
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoice_history_invoice
  ON invoice_history (invoice_id, created_at);

ALTER TABLE sale_tabs ADD COLUMN exchanged_item_ids TEXT;
