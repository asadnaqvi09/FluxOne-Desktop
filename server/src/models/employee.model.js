/**
 * Employees + assigned POS cashier (Admin)
 */
import { connectDb } from '../config/database.js';

const EMPLOYEE_FIELDS = `
  id,
  user_id AS userId,
  name,
  role,
  email,
  picture_url AS pictureUrl,
  is_active AS isActive
`;

export function runTx(fn) {
  return connectDb().transaction(fn)();
}

export function listEmployees(role) {
  const db = connectDb();
  const rows = role
    ? db
        .prepare(
          `
      SELECT ${EMPLOYEE_FIELDS}
      FROM employees
      WHERE role = ?
      ORDER BY name ASC
    `
        )
        .all(role)
    : db
        .prepare(
          `
      SELECT ${EMPLOYEE_FIELDS}
      FROM employees
      ORDER BY role ASC, name ASC
    `
        )
        .all();
  return rows.map((row) => ({ ...row, isActive: Boolean(row.isActive) }));
}

export function findEmployeeById(id) {
  const db = connectDb();
  const row = db
    .prepare(
      `
    SELECT ${EMPLOYEE_FIELDS}
    FROM employees
    WHERE id = ?
    LIMIT 1
  `
    )
    .get(id);
  if (!row) return null;
  return { ...row, isActive: Boolean(row.isActive) };
}

export function getCurrentCashier() {
  const db = connectDb();
  const row = db
    .prepare(
      `
    SELECT e.id, e.user_id AS userId, e.name, e.role, e.email,
           e.picture_url AS pictureUrl, e.is_active AS isActive,
           a.assigned_at AS assignedAt, a.assigned_by AS assignedBy,
           ab.name AS assignedByName
    FROM assigned_cashier a
    JOIN employees e ON e.id = a.employee_id
    LEFT JOIN employees ab ON ab.id = a.assigned_by
    WHERE a.id = 1
    LIMIT 1
  `
    )
    .get();
  if (!row) return null;
  return { ...row, isActive: Boolean(row.isActive) };
}

export function assignCashier({ employeeId, assignedBy }) {
  const db = connectDb();
  db.prepare(
    `
    INSERT INTO assigned_cashier (id, employee_id, assigned_by)
    VALUES (1, @employeeId, @assignedBy)
    ON CONFLICT(id) DO UPDATE SET
      employee_id = excluded.employee_id,
      assigned_by = excluded.assigned_by,
      assigned_at = datetime('now')
  `
  ).run({ employeeId, assignedBy });
  return getCurrentCashier();
}

export function listActiveCashiers() {
  const db = connectDb();
  return db
    .prepare(
      `
    SELECT id, user_id AS userId, name, role, picture_url AS pictureUrl
    FROM employees
    WHERE role = 'cashier' AND is_active = 1
    ORDER BY name ASC
  `
    )
    .all();
}

export function updateEmployee(id, patch = {}) {
  const existing = findEmployeeById(id);
  if (!existing) return null;

  const next = {
    id,
    name: patch.name !== undefined ? String(patch.name).trim() : existing.name,
    userId:
      patch.userId !== undefined ? String(patch.userId).trim() : existing.userId,
    pictureUrl:
      patch.pictureUrl !== undefined
        ? patch.pictureUrl === '' || patch.pictureUrl == null
          ? null
          : String(patch.pictureUrl).trim()
        : existing.pictureUrl,
    isActive:
      patch.isActive !== undefined
        ? patch.isActive
          ? 1
          : 0
        : existing.isActive
          ? 1
          : 0,
  };

  if (!next.name) {
    const err = new Error('Name is required');
    err.statusCode = 400;
    throw err;
  }
  if (!next.userId) {
    const err = new Error('User ID is required');
    err.statusCode = 400;
    throw err;
  }

  if (next.userId !== existing.userId) {
    const db = connectDb();
    const clash = db
      .prepare(`SELECT id FROM employees WHERE user_id = ? LIMIT 1`)
      .get(next.userId);
    if (clash && clash.id !== id) {
      const err = new Error('User ID already in use');
      err.statusCode = 409;
      throw err;
    }
  }

  const db = connectDb();
  db.prepare(
    `
    UPDATE employees SET
      name = @name,
      user_id = @userId,
      picture_url = @pictureUrl,
      is_active = @isActive,
      updated_at = datetime('now')
    WHERE id = @id
  `
  ).run(next);
  return findEmployeeById(id);
}
