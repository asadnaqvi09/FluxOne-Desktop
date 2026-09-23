-- Identity, sessions, till / cash drawer, activity logs
-- Used by: Auth (1.2), Sync session flags (1.3), Till (1.4), Admin cashiers (1.12)

CREATE TABLE IF NOT EXISTS store_profile (
  id TEXT PRIMARY KEY CHECK (id = 'store'),
  name TEXT NOT NULL,
  contact_phone TEXT,
  contact_email TEXT,
  address TEXT,
  warning_message TEXT,
  return_instructions TEXT,
  shop_open_time TEXT NOT NULL DEFAULT '09:00',
  shop_close_time TEXT NOT NULL DEFAULT '18:00',
  supervisor_pin_hash TEXT,
  currency TEXT NOT NULL DEFAULT 'PKR',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'cashier', 'supervisor')),
  password_hash TEXT NOT NULL,
  pin_hash TEXT,
  picture_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assigned_cashier (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  assigned_by TEXT REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  last_synced_at TEXT,
  sync_ok INTEGER NOT NULL DEFAULT 0 CHECK (sync_ok IN (0, 1)),
  is_locked INTEGER NOT NULL DEFAULT 0 CHECK (is_locked IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS till_sessions (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  auth_session_id TEXT REFERENCES auth_sessions(id),
  opening_float REAL NOT NULL DEFAULT 0,
  counted_cash REAL,
  expected_cash REAL,
  variance REAL,
  remarks TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_till_one_open
  ON till_sessions (employee_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_till_sessions_employee
  ON till_sessions (employee_id);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_employee
  ON auth_sessions (employee_id);

CREATE TABLE IF NOT EXISTS cash_movements (
  id TEXT PRIMARY KEY,
  till_session_id TEXT NOT NULL REFERENCES till_sessions(id),
  type TEXT NOT NULL CHECK (type IN ('opening', 'sale_in', 'refund_out')),
  amount REAL NOT NULL,
  invoice_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_till
  ON cash_movements (till_session_id);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  employee_id TEXT REFERENCES employees(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created
  ON activity_logs (created_at);

CREATE INDEX IF NOT EXISTS idx_activity_logs_action
  ON activity_logs (action);
