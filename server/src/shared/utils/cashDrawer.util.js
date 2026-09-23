import { v4 as uuid } from 'uuid';
import { money } from './money.util.js';

/** Safe cash-drawer fields for API responses. */
export function publicDrawer(row) {
  if (!row) return null;
  return {
    id: row.id,
    employeeId: row.employeeId,
    openingFloat: row.openingFloat,
    countedCash: row.countedCash,
    expectedCash: row.expectedCash,
    variance: row.variance,
    remarks: row.remarks,
    status: row.status,
    openedAt: row.openedAt,
    closedAt: row.closedAt,
  };
}

/** Short human-readable drawer session id (SES-XXXXXXXX). */
export function nextDrawerId() {
  return `SES-${uuid().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

export { money };
