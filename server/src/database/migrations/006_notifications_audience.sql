-- Notifications: audience for role filter (Phase 1.11)
-- Existing rows default to cashier (POS bell). read_at set when marked read.

ALTER TABLE notifications ADD COLUMN audience TEXT NOT NULL DEFAULT 'cashier';
ALTER TABLE notifications ADD COLUMN read_at TEXT;
