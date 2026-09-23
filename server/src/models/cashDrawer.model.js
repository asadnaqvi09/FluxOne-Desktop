/**
 * Cash Drawer Session model
 * One open cash drawer per cashier shift: open → sell → count → close.
 */
import bcrypt from 'bcrypt';
import { connectDb } from '../config/database.js';

const DRAWER_FIELDS = `
  id,
  employee_id AS employeeId,
  auth_session_id AS authSessionId,
  opening_float AS openingFloat,
  counted_cash AS countedCash,
  expected_cash AS expectedCash,
  variance,
  remarks,
  status,
  opened_at AS openedAt,
  closed_at AS closedAt
`;

export function runTx(fn) {
  return connectDb().transaction(fn)();
}

export function findOpenCashDrawer(employeeId) {
  const db = connectDb();
  return (
    db
      .prepare(
        `
      SELECT ${DRAWER_FIELDS}
      FROM cash_drawer_sessions
      WHERE employee_id = ? AND status = 'open'
      LIMIT 1
    `
      )
      .get(employeeId) || null
  );
}

export function findCashDrawerById(id) {
  const db = connectDb();
  return (
    db
      .prepare(
        `
      SELECT ${DRAWER_FIELDS}
      FROM cash_drawer_sessions
      WHERE id = ?
      LIMIT 1
    `
      )
      .get(id) || null
  );
}

export function createCashDrawer({ id, employeeId, authSessionId, openingFloat }) {
  const db = connectDb();
  db.prepare(
    `
    INSERT INTO cash_drawer_sessions (
      id, employee_id, auth_session_id, opening_float, status
    ) VALUES (@id, @employeeId, @authSessionId, @openingFloat, 'open')
  `
  ).run({ id, employeeId, authSessionId, openingFloat });
  return findCashDrawerById(id);
}

export function addCashMovement({ id, cashDrawerId, type, amount, invoiceId = null }) {
  const db = connectDb();
  db.prepare(
    `
    INSERT INTO cash_movements (id, cash_drawer_id, type, amount, invoice_id)
    VALUES (@id, @cashDrawerId, @type, @amount, @invoiceId)
  `
  ).run({ id, cashDrawerId, type, amount, invoiceId });
}

export function getExpectedCash(cashDrawerId, openingFloat) {
  const db = connectDb();
  const sums = db
    .prepare(
      `
    SELECT
      COALESCE(SUM(CASE WHEN type = 'sale_in' THEN amount ELSE 0 END), 0) AS saleIn,
      COALESCE(SUM(CASE WHEN type = 'refund_out' THEN amount ELSE 0 END), 0) AS refundOut
    FROM cash_movements
    WHERE cash_drawer_id = ?
  `
    )
    .get(cashDrawerId);
  const expected = Number(openingFloat) + Number(sums.saleIn) - Number(sums.refundOut);
  return {
    openingFloat: Number(openingFloat),
    saleIn: Number(sums.saleIn),
    refundOut: Number(sums.refundOut),
    expectedCash: Number(expected.toFixed(2)),
  };
}

export function hasOpenCartsWithItems(cashDrawerId) {
  const db = connectDb();
  const row = db
    .prepare(
      `
    SELECT t.id
    FROM sale_tabs t
    WHERE t.cash_drawer_id = ?
      AND t.status = 'open'
      AND EXISTS (SELECT 1 FROM sale_tab_items i WHERE i.tab_id = t.id AND i.qty > 0)
    LIMIT 1
  `
    )
    .get(cashDrawerId);
  return Boolean(row);
}

export function closeCashDrawer({ id, countedCash, expectedCash, variance, remarks }) {
  const db = connectDb();
  db.prepare(
    `
    UPDATE cash_drawer_sessions SET
      counted_cash = @countedCash,
      expected_cash = @expectedCash,
      variance = @variance,
      remarks = @remarks,
      status = 'closed',
      closed_at = datetime('now')
    WHERE id = @id AND status = 'open'
  `
  ).run({ id, countedCash, expectedCash, variance, remarks: remarks || null });
  db.prepare(
    `
    UPDATE sale_tabs SET status = 'void', updated_at = datetime('now')
    WHERE cash_drawer_id = ? AND status = 'open'
  `
  ).run(id);
  return findCashDrawerById(id);
}

/** First tab of a newly opened cash drawer — always Sale 1. */
export function createEmptySaleTab({ id, cashDrawerId, employeeId, authSessionId }) {
  const db = connectDb();
  const tabIndex = 1;
  db.prepare(
    `
    INSERT INTO sale_tabs (
      id, cash_drawer_id, employee_id, auth_session_id, tab_index, status, mode
    ) VALUES (@id, @cashDrawerId, @employeeId, @authSessionId, @tabIndex, 'open', 'sale')
  `
  ).run({ id, cashDrawerId, employeeId, authSessionId, tabIndex });
  return { id, tabIndex };
}

export function getSupervisorPinHash() {
  const db = connectDb();
  return (
    db
      .prepare(
        `
      SELECT supervisor_pin_hash AS pinHash
      FROM store_profile
      WHERE id = 'store'
    `
      )
      .get()?.pinHash || null
  );
}

export function verifyBranchManagerPassword(password) {
  if (!password) return false;
  const db = connectDb();
  const admins = db
    .prepare(
      `
    SELECT password_hash AS passwordHash
    FROM employees
    WHERE role = 'admin' AND is_active = 1
  `
    )
    .all();
  return admins.some((admin) => bcrypt.compareSync(password, admin.passwordHash));
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
