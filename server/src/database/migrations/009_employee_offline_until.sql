-- Cashier 24h offline-login window (survives logout).
-- Admin does not use this column — admin can always log in offline.

ALTER TABLE employees ADD COLUMN offline_until TEXT;

-- If a cashier already has a live 24h session, keep that window after this migration.
UPDATE employees
SET offline_until = (
  SELECT MAX(expires_at)
  FROM auth_sessions
  WHERE auth_sessions.employee_id = employees.id
    AND auth_sessions.expires_at > datetime('now')
)
WHERE role = 'cashier';
