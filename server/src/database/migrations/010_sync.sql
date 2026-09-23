-- Cloud sync engine: outbox queue, sync metadata, POS counters, invoice sync columns
-- Used by: Sync service (Phases 2–8)
-- Keeps sync_state for backward compat until Phase 5 controller rewrite.

CREATE TABLE IF NOT EXISTS sync_outbox (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  client_event_id TEXT NOT NULL UNIQUE,
  event_type      TEXT NOT NULL CHECK (event_type IN ('sale', 'refund', 'cashier_log', 'attendance')),
  payload         TEXT NOT NULL,
  device_id       TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at       TEXT,
  sync_status     TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'sent', 'failed')),
  retry_count     INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_outbox_pending
  ON sync_outbox (sync_status, created_at)
  WHERE sync_status = 'pending';

CREATE TABLE IF NOT EXISTS sync_meta (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  tenant_id        TEXT,
  branch_id        TEXT,
  device_id        TEXT,
  cloud_api_url    TEXT,
  last_pull_at     TEXT,
  last_push_at     TEXT,
  bootstrap_done   INTEGER NOT NULL DEFAULT 0 CHECK (bootstrap_done IN (0, 1)),
  access_token     TEXT,
  refresh_token    TEXT,
  token_expires_at TEXT
);

-- Default singleton row; migrate timestamps from legacy sync_state if present.
INSERT OR IGNORE INTO sync_meta (id, bootstrap_done)
VALUES (1, 0);

INSERT OR IGNORE INTO sync_meta (id, last_pull_at, bootstrap_done)
SELECT
  1,
  last_synced_at,
  CASE WHEN last_synced_at IS NOT NULL THEN 1 ELSE 0 END
FROM sync_state
WHERE id = 1;

UPDATE sync_meta
SET
  last_pull_at = (SELECT last_synced_at FROM sync_state WHERE id = 1),
  bootstrap_done = CASE
    WHEN (SELECT last_synced_at FROM sync_state WHERE id = 1) IS NOT NULL THEN 1
    ELSE bootstrap_done
  END
WHERE id = 1
  AND EXISTS (SELECT 1 FROM sync_state WHERE id = 1);

CREATE TABLE IF NOT EXISTS pos_counters (
  id        TEXT PRIMARY KEY,
  code      TEXT NOT NULL,
  name      TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_pos_counters_active
  ON pos_counters (is_active, code);

ALTER TABLE invoices ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash';
ALTER TABLE invoices ADD COLUMN counter_id TEXT REFERENCES pos_counters(id);
ALTER TABLE invoices ADD COLUMN cloud_synced_at TEXT;

CREATE INDEX IF NOT EXISTS idx_invoices_cloud_sync
  ON invoices (cloud_synced_at)
  WHERE cloud_synced_at IS NULL;
