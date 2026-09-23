-- Push parity: store cloud sale UUID after successful outbox push
ALTER TABLE invoices ADD COLUMN cloud_sale_id TEXT;

CREATE INDEX IF NOT EXISTS idx_invoices_cloud_sale
  ON invoices (cloud_sale_id)
  WHERE cloud_sale_id IS NOT NULL;
