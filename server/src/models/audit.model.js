/**
 * Activity logs (Admin)
 */
import { connectDb } from '../config/database.js';
import {
  auditShopWindow,
  shopLocalCreatedAt,
} from '../shared/utils/shopTime.util.js';

export function listLogs({ date, from, to } = {}) {
  const clauses = [];
  const params = {};
  const localAt = shopLocalCreatedAt('a');
  const window = auditShopWindow({ date, from, to });
  if (window?.from) {
    clauses.push(`${localAt} >= @from`);
    params.from = window.from;
  }
  if (window?.to) {
    clauses.push(`${localAt} <= @to`);
    params.to = window.to;
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const db = connectDb();
  return db
    .prepare(
      `
      SELECT a.id, a.created_at AS createdAt, a.action,
             a.entity_type AS entityType, a.entity_id AS entityId, a.details,
             a.employee_id AS actorId, e.user_id AS actorUserId,
             e.name AS actorName, e.role AS actorRole
      FROM activity_logs a
      LEFT JOIN employees e ON e.id = a.employee_id
      ${where}
      ORDER BY a.created_at DESC, a.rowid DESC
    `
    )
    .all(params);
}
