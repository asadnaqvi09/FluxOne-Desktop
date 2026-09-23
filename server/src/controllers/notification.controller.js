import { success, error } from '../shared/utils/response.js';
import { roleAudience } from '../shared/utils/notification.util.js';
import * as notificationModel from '../models/notification.model.js';

// List — system + admin, filtered by current role
export function list(req, res) {
  try {
    const role = roleAudience(req.auth.role);
    const source = req.validatedQuery?.source;
    const notifications = notificationModel.listForUser({
      employeeId: req.auth.employeeId,
      role,
      source: source || null,
    });
    const unreadCount = notificationModel.unreadCount({
      employeeId: req.auth.employeeId,
      role,
    });
    return success(res, { notifications, unreadCount });
  } catch (err) {
    return error(res, err.message || 'Failed to list notifications', err.statusCode || 500, err.code || null);
  }
}

// Mark one read
export function markRead(req, res) {
  try {
    const role = roleAudience(req.auth.role);
    const row = notificationModel.findOwned(req.params.id, req.auth.employeeId, role);
    if (!row) return error(res, 'Notification not found', 404);
    notificationModel.markRead(req.params.id, req.auth.employeeId);
    return success(res, { id: req.params.id, isRead: true });
  } catch (err) {
    return error(res, err.message || 'Failed to mark notification read', err.statusCode || 500, err.code || null);
  }
}

// Clear this user's notifications
export function clear(req, res) {
  try {
    const cleared = notificationModel.clearForUser(req.auth.employeeId);
    return success(res, { cleared });
  } catch (err) {
    return error(res, err.message || 'Failed to clear notifications', err.statusCode || 500, err.code || null);
  }
}
