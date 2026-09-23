-- Rename Till → Cash Drawer (product naming)
-- Applied after 001–006 on existing DBs; fresh installs create till_* then this renames.

ALTER TABLE till_sessions RENAME TO cash_drawer_sessions;

DROP INDEX IF EXISTS idx_till_one_open;
DROP INDEX IF EXISTS idx_till_sessions_employee;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_drawer_one_open
  ON cash_drawer_sessions (employee_id)
  WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_cash_drawer_sessions_employee
  ON cash_drawer_sessions (employee_id);

ALTER TABLE cash_movements RENAME COLUMN till_session_id TO cash_drawer_id;
DROP INDEX IF EXISTS idx_cash_movements_till;
CREATE INDEX IF NOT EXISTS idx_cash_movements_drawer
  ON cash_movements (cash_drawer_id);

ALTER TABLE sale_tabs RENAME COLUMN till_session_id TO cash_drawer_id;
DROP INDEX IF EXISTS idx_sale_tabs_till;
CREATE INDEX IF NOT EXISTS idx_sale_tabs_drawer
  ON sale_tabs (cash_drawer_id, status);

ALTER TABLE invoices RENAME COLUMN till_session_id TO cash_drawer_id;

UPDATE activity_logs SET action = 'open_cash_drawer' WHERE action = 'open_till';
UPDATE activity_logs SET action = 'close_cash_drawer' WHERE action = 'close_till';
UPDATE activity_logs SET entity_type = 'cash_drawer' WHERE entity_type = 'till';

UPDATE id_counters SET name = 'cash_drawer' WHERE name = 'till';
