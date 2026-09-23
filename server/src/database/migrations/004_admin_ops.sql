-- Admin ops: notifications, sync snapshot, invoice sequence
-- Used by: Sync (1.3), Notifications (1.11), Admin (1.12)
-- Note: app_releases table kept for older DBs; app no longer reads/writes it.

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  employee_id TEXT REFERENCES employees(id),
  source TEXT NOT NULL CHECK (source IN ('system', 'admin')),
  title TEXT NOT NULL,
  body TEXT,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_employee
  ON notifications (employee_id, is_read, created_at);

CREATE TABLE IF NOT EXISTS sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_synced_at TEXT,
  source TEXT NOT NULL DEFAULT 'local'
);

CREATE TABLE IF NOT EXISTS id_counters (
  name TEXT PRIMARY KEY,
  last_value INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_releases (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  notes TEXT,
  file_path TEXT,
  published_at TEXT
);
