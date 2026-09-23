import { success, error } from '../shared/utils/response.js';
import * as auditModel from '../models/audit.model.js';

// Activity logs — date-to-date (login, sale, return, exchange, price_change, change_cashier, …)
export function list(req, res) {
  try {
    const q = req.validatedQuery || {};
    const logs = auditModel.listLogs({
      date: q.date,
      from: q.from,
      to: q.to,
    });
    return success(res, { logs, count: logs.length });
  } catch (err) {
    return error(res, err.message || 'Failed to list activity logs', err.statusCode || 500, err.code || null);
  }
}
