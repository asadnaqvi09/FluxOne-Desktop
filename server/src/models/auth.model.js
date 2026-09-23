import { connectDb } from '../config/database.js';

const EMPLOYEE_FIELDS = `
  id,
  user_id AS userId,
  name,
  role,
  email,
  password_hash AS passwordHash,
  pin_hash AS pinHash,
  picture_url AS pictureUrl,
  is_active AS isActive,
  offline_until AS offlineUntil
`;

const SESSION_FIELDS = `
  id,
  employee_id AS employeeId,
  token_hash AS tokenHash,
  expires_at AS expiresAt,
  last_synced_at AS lastSyncedAt,
  sync_ok AS syncOk,
  is_locked AS isLocked,
  created_at AS createdAt
`;

export function findEmployeeByUserId(userId) {
  const db = connectDb();
  return (
    db
      .prepare(
        `
      SELECT ${EMPLOYEE_FIELDS}
      FROM employees
      WHERE user_id = ?
      LIMIT 1
    `
      )
      .get(userId) || null
  );
}

export function findEmployeeById(id) {
  const db = connectDb();
  return (
    db
      .prepare(
        `
      SELECT ${EMPLOYEE_FIELDS}
      FROM employees
      WHERE id = ?
      LIMIT 1
    `
      )
      .get(id) || null
  );
}

export function updateProfile(id, { name, email }) {
  const db = connectDb();
  db.prepare(
    `
    UPDATE employees SET
      name = @name,
      email = @email,
      updated_at = datetime('now')
    WHERE id = @id
  `
  ).run({
    id,
    name: String(name || '').trim(),
    email: email == null || email === '' ? null : String(email).trim(),
  });
  return findEmployeeById(id);
}

export function findSessionById(id) {
  const db = connectDb();
  return (
    db
      .prepare(
        `
      SELECT ${SESSION_FIELDS}
      FROM auth_sessions
      WHERE id = ?
      LIMIT 1
    `
      )
      .get(id) || null
  );
}

export function findActiveSessionById(id) {
  const db = connectDb();
  return (
    db
      .prepare(
        `
      SELECT ${SESSION_FIELDS}
      FROM auth_sessions
      WHERE id = ? AND expires_at > datetime('now')
      LIMIT 1
    `
      )
      .get(id) || null
  );
}

export function findSessionByTokenHash(tokenHash) {
  const db = connectDb();
  return (
    db
      .prepare(
        `
      SELECT ${SESSION_FIELDS}
      FROM auth_sessions
      WHERE token_hash = ?
      LIMIT 1
    `
      )
      .get(tokenHash) || null
  );
}

export function expiresAtInHours(hours) {
  const db = connectDb();
  return db
    .prepare(`SELECT datetime('now', ?) AS expiresAt`)
    .get(`+${Number(hours)} hours`).expiresAt;
}

/** True when cashier still has time left to sign in without internet. */
export function hasOfflineWindow(employeeId) {
  const db = connectDb();
  const row = db
    .prepare(
      `
      SELECT 1 AS ok
      FROM employees
      WHERE id = ?
        AND offline_until IS NOT NULL
        AND offline_until > datetime('now')
      LIMIT 1
    `
    )
    .get(employeeId);
  return Boolean(row);
}

/** Last online cashier login sets this. Logout must not clear it. */
export function setOfflineUntil(employeeId, offlineUntil) {
  const db = connectDb();
  db.prepare(
    `
    UPDATE employees
    SET offline_until = ?, updated_at = datetime('now')
    WHERE id = ?
  `
  ).run(offlineUntil, employeeId);
}

export function getOfflineUntil(employeeId) {
  const db = connectDb();
  const row = db
    .prepare(
      `
      SELECT offline_until AS offlineUntil
      FROM employees
      WHERE id = ?
      LIMIT 1
    `
    )
    .get(employeeId);
  return row?.offlineUntil || null;
}

export function createSession({ id, employeeId, tokenHash, expiresAt, syncOk = 0 }) {
  const db = connectDb();
  db.prepare(
    `
    INSERT INTO auth_sessions (id, employee_id, token_hash, expires_at, sync_ok, is_locked)
    VALUES (@id, @employeeId, @tokenHash, @expiresAt, @syncOk, 0)
  `
  ).run({
    id,
    employeeId,
    tokenHash,
    expiresAt,
    syncOk: syncOk ? 1 : 0,
  });
  return findSessionById(id);
}

export function setSessionLocked(sessionId, locked) {
  const db = connectDb();
  db.prepare(`UPDATE auth_sessions SET is_locked = ? WHERE id = ?`).run(
    locked ? 1 : 0,
    sessionId
  );
}

export function deleteSession(sessionId) {
  const db = connectDb();
  db.prepare(
    `UPDATE cash_drawer_sessions SET auth_session_id = NULL WHERE auth_session_id = ?`
  ).run(sessionId);
  db.prepare(
    `UPDATE sale_tabs SET auth_session_id = NULL WHERE auth_session_id = ?`
  ).run(sessionId);
  db.prepare(`DELETE FROM auth_sessions WHERE id = ?`).run(sessionId);
}

export function deleteEmployeeSessions(employeeId) {
  const db = connectDb();
  db.prepare(
    `UPDATE cash_drawer_sessions SET auth_session_id = NULL WHERE employee_id = ?`
  ).run(employeeId);
  db.prepare(
    `UPDATE sale_tabs SET auth_session_id = NULL WHERE employee_id = ?`
  ).run(employeeId);
  db.prepare(`DELETE FROM auth_sessions WHERE employee_id = ?`).run(employeeId);
}

export function hasOpenCashDrawer(employeeId) {
  const db = connectDb();
  const row = db
    .prepare(
      `
    SELECT id FROM cash_drawer_sessions
    WHERE employee_id = ? AND status = 'open'
    LIMIT 1
  `
    )
    .get(employeeId);
  return Boolean(row);
}

export function logActivity({
  id,
  employeeId,
  action,
  entityType = null,
  entityId = null,
  details = null,
}) {
  const db = connectDb();
  db.prepare(
    `
    INSERT INTO activity_logs (id, employee_id, action, entity_type, entity_id, details)
    VALUES (@id, @employeeId, @action, @entityType, @entityId, @details)
  `
  ).run({ id, employeeId, action, entityType, entityId, details });
}

/** Run fn inside a SQLite transaction (same idea as BEGIN/COMMIT in Postgres). */
export function loginTransaction(fn) {
  return connectDb().transaction(fn)();
}
