/**
 * Notifications — system (sync, sale, lock, cash drawer) and admin (price, assignment).
 * Filtered by audience for the current role + this employee (or broadcast).
 */
import { connectDb } from '../config/database.js';
import { NOTIFICATION_AUDIENCE } from '../config/constants.js';
import { publicNotification } from '../shared/utils/notification.util.js';

const NOTIFICATION_FIELDS = `
  id,
  employee_id AS employeeId,
  source,
  audience,
  title,
  body,
  is_read AS isRead,
  created_at AS createdAt,
  read_at AS readAt
`;

export function runTx(fn) {
  return connectDb().transaction(fn)();
}

export function listForUser({ employeeId, role, source }) {
  const db = connectDb();
  const params = { employeeId, role };
  const rows = source
    ? db
        .prepare(
          `
      SELECT ${NOTIFICATION_FIELDS}
      FROM notifications
      WHERE (audience = @role OR audience = 'all')
        AND (employee_id IS NULL OR employee_id = @employeeId)
        AND source = @source
      ORDER BY created_at DESC, rowid DESC
    `
        )
        .all({ ...params, source })
    : db
        .prepare(
          `
      SELECT ${NOTIFICATION_FIELDS}
      FROM notifications
      WHERE (audience = @role OR audience = 'all')
        AND (employee_id IS NULL OR employee_id = @employeeId)
      ORDER BY created_at DESC, rowid DESC
    `
        )
        .all(params);
  return rows.map(publicNotification);
}

export function unreadCount({ employeeId, role }) {
  const db = connectDb();
  return db
    .prepare(
      `
    SELECT COUNT(*) AS n FROM notifications
    WHERE (audience = @role OR audience = 'all')
      AND (employee_id IS NULL OR employee_id = @employeeId)
      AND is_read = 0
  `
    )
    .get({ employeeId, role }).n;
}

export function findOwned(id, employeeId, role) {
  const db = connectDb();
  return (
    db
      .prepare(
        `
      SELECT id FROM notifications
      WHERE id = @id
        AND (audience = @role OR audience = 'all')
        AND (employee_id IS NULL OR employee_id = @employeeId)
      LIMIT 1
    `
      )
      .get({ id, employeeId, role }) || null
  );
}

export function markRead(id, employeeId) {
  const db = connectDb();
  return (
    db
      .prepare(
        `
      UPDATE notifications
      SET is_read = 1, read_at = datetime('now')
      WHERE id = @id
        AND (employee_id IS NULL OR employee_id = @employeeId)
    `
      )
      .run({ id, employeeId }).changes > 0
  );
}

export function clearForUser(employeeId) {
  const db = connectDb();
  return db.prepare(`DELETE FROM notifications WHERE employee_id = ?`).run(employeeId)
    .changes;
}

export function insert({
  id,
  employeeId,
  source,
  audience = NOTIFICATION_AUDIENCE.CASHIER,
  title,
  body = null,
}) {
  const db = connectDb();
  db.prepare(
    `
    INSERT INTO notifications (id, employee_id, source, audience, title, body)
    VALUES (@id, @employeeId, @source, @audience, @title, @body)
  `
  ).run({ id, employeeId, source, audience, title, body });
}
