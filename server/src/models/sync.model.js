import { connectDb } from '../config/database.js';

export function runSyncTransaction(fn) {
  return connectDb().transaction(fn)();
}

export function markSessionSynced(sessionId) {
  const db = connectDb();
  const before =
    db
      .prepare(
        `
      SELECT sync_ok AS syncOk
      FROM auth_sessions
      WHERE id = ?
    `
      )
      .get(sessionId) || null;
  const firstSyncOfSession = before?.syncOk !== 1;

  db.prepare(
    `
    UPDATE auth_sessions
    SET sync_ok = 1, last_synced_at = datetime('now')
    WHERE id = ?
  `
  ).run(sessionId);

  const session =
    db
      .prepare(
        `
      SELECT id, sync_ok AS syncOk, last_synced_at AS lastSyncedAt
      FROM auth_sessions
      WHERE id = ?
    `
      )
      .get(sessionId) || null;

  return session ? { ...session, firstSyncOfSession } : null;
}

export function upsertSyncState(source = 'local') {
  const db = connectDb();
  db.prepare(
    `
    INSERT INTO sync_state (id, last_synced_at, source)
    VALUES (1, datetime('now'), @source)
    ON CONFLICT(id) DO UPDATE SET
      last_synced_at = excluded.last_synced_at,
      source = excluded.source
  `
  ).run({ source });
  return (
    db
      .prepare(
        `
      SELECT last_synced_at AS lastSyncedAt, source
      FROM sync_state
      WHERE id = 1
    `
      )
      .get() || null
  );
}

export function getCatalogSnapshot() {
  const db = connectDb();
  const counts = db
    .prepare(
      `
    SELECT
      (SELECT COUNT(*) FROM categories WHERE is_active = 1) AS categories,
      (SELECT COUNT(*) FROM subcategories WHERE is_active = 1) AS subcategories,
      (SELECT COUNT(*) FROM products WHERE is_active = 1) AS products,
      (SELECT COUNT(*) FROM tax_rules WHERE is_active = 1) AS taxRules
  `
    )
    .get();
  const storeProfile =
    db
      .prepare(
        `
      SELECT name, contact_phone AS contactPhone, contact_email AS contactEmail,
             address, warning_message AS warningMessage,
             return_instructions AS returnInstructions,
             shop_open_time AS shopOpenTime, shop_close_time AS shopCloseTime, currency
      FROM store_profile
      WHERE id = 'store'
    `
      )
      .get() || null;
  const assignedCashier =
    db
      .prepare(
        `
      SELECT e.id, e.user_id AS userId, e.name, e.role, e.picture_url AS pictureUrl
      FROM assigned_cashier a
      JOIN employees e ON e.id = a.employee_id
      WHERE a.id = 1
    `
      )
      .get() || null;
  return { counts, storeProfile, assignedCashier };
}

export function logActivity(row) {
  const db = connectDb();
  db.prepare(
    `
    INSERT INTO activity_logs (id, employee_id, action, entity_type, entity_id, details)
    VALUES (@id, @employeeId, @action, @entityType, @entityId, @details)
  `
  ).run(row);
}

export function createNotification(row) {
  const db = connectDb();
  db.prepare(
    `
    INSERT INTO notifications (id, employee_id, source, title, body)
    VALUES (@id, @employeeId, @source, @title, @body)
  `
  ).run(row);
}
