-- Allow POS Items Rate → cloud product_price_update on sync outbox.
-- SQLite cannot ALTER CHECK; rebuild sync_outbox with expanded event_type.

CREATE TABLE sync_outbox_new (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  client_event_id TEXT NOT NULL UNIQUE,
  event_type      TEXT NOT NULL CHECK (event_type IN (
    'sale',
    'refund',
    'cashier_log',
    'attendance',
    'product_price_update'
  )),
  payload         TEXT NOT NULL,
  device_id       TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at       TEXT,
  sync_status     TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'sent', 'failed')),
  retry_count     INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT
);

INSERT INTO sync_outbox_new (
  id, client_event_id, event_type, payload, device_id,
  created_at, synced_at, sync_status, retry_count, last_error
)
SELECT
  id, client_event_id, event_type, payload, device_id,
  created_at, synced_at, sync_status, retry_count, last_error
FROM sync_outbox;

DROP TABLE sync_outbox;

ALTER TABLE sync_outbox_new RENAME TO sync_outbox;

CREATE INDEX IF NOT EXISTS idx_sync_outbox_pending
  ON sync_outbox (sync_status, created_at)
  WHERE sync_status = 'pending';
