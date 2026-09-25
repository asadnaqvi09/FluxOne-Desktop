import { v4 as uuid } from 'uuid';
import bcrypt from 'bcrypt';
import config from '../config/index.js';
import {
  ACTIVITY_ACTION,
  ERROR_CODE,
  NOTIFICATION_AUDIENCE,
  NOTIFICATION_SOURCE,
  ROLES,
} from '../config/constants.js';
import { success, error } from '../shared/utils/response.js';
import { isRequestOnline } from '../shared/middlewares/online.middleware.js';
import { hashToken } from '../shared/utils/tokenHash.js';
import {
  publicEmployee,
  signToken,
  authPayload,
} from '../shared/utils/auth.util.js';
import { clearAuthCookie, setAuthCookie } from '../shared/utils/authCookie.js';
import * as authModel from '../models/auth.model.js';
import * as notificationModel from '../models/notification.model.js';
import * as outboxHooks from '../modules/sync/outboxHooks.js';
import { isBcryptPasswordHash } from '../shared/utils/passwordHash.js';
import { isSyncReady } from '../shared/middlewares/sync.middleware.js';

/**
 * Cashier Sync gate (TL):
 * - Require Sync on first use (no cached catalog / bootstrap) OR after 24h offline window expired.
 * - Skip Sync on re-login while still inside the 24h window (catalog already local).
 */
function resolveCashierSessionSyncOk(employeeId) {
  if (!isSyncReady()) return 0;
  if (authModel.hasOfflineWindow(employeeId)) return 1;
  return 0;
}

function passwordMatches(typedPassword, storedHash) {
  if (!typedPassword || !isBcryptPasswordHash(storedHash)) return false;
  return bcrypt.compareSync(typedPassword, storedHash);
}

// Login
export function login(req, res) {
  try {
    const { userId, password } = req.body;
    const online = isRequestOnline(req);
    const employee = authModel.findEmployeeByUserId(userId);
    if (!employee || !employee.isActive) {
      return error(res, 'Invalid user ID or password', 401);
    }
    if (!passwordMatches(password, employee.passwordHash)) {
      return error(res, 'Invalid user ID or password', 401);
    }

    const isCashier = employee.role === ROLES.CASHIER;

    // Admin: always local login (network down is OK).
    // Cashier: first login / after 24h needs network. Logout does not clear the 24h window.
    if (isCashier && !online && !authModel.hasOfflineWindow(employee.id)) {
      return error(
        res,
        'Network required for first login or after 24h expiry',
        503,
        ERROR_CODE.OFFLINE
      );
    }

    // Capture before online login refreshes offline_until
    const sessionSyncOk = isCashier ? resolveCashierSessionSyncOk(employee.id) : 0;

    const data = authModel.loginTransaction(() => {
      const sessionId = uuid();
      let expiresAt;

      if (isCashier && !online) {
        // Keep the same 24h window from the last online login (do not extend it).
        expiresAt = authModel.getOfflineUntil(employee.id);
      } else {
        expiresAt = authModel.expiresAtInHours(config.authTtlHours);
      }
      if (!expiresAt) {
        expiresAt = authModel.expiresAtInHours(config.authTtlHours);
      }

      if (isCashier && online) {
        authModel.setOfflineUntil(employee.id, expiresAt);
      }

      authModel.deleteEmployeeSessions(employee.id);
      const token = signToken({
        sessionId,
        employeeId: employee.id,
        role: employee.role,
        userId: employee.userId,
        expiresAt,
      });
      const session = authModel.createSession({
        id: sessionId,
        employeeId: employee.id,
        tokenHash: hashToken(token),
        expiresAt,
        syncOk: sessionSyncOk,
      });
      authModel.logActivity({
        id: uuid(),
        employeeId: employee.id,
        action: ACTIVITY_ACTION.LOGIN,
        entityType: 'auth_session',
        entityId: session.id,
      });
      outboxHooks.queueCashierLog({
        action: ACTIVITY_ACTION.LOGIN,
        employeeId: employee.id,
        employee,
        entityType: 'auth_session',
        entityId: session.id,
      });
      return authPayload(employee, session, token);
    });
    // HttpOnly cookie — primary storage; body token remains for Bearer fallback
    setAuthCookie(res, data.token, data.expiresAt);
    return success(res, data);
  } catch (err) {
    return error(res, err.message || 'Login failed', err.statusCode || 500, err.code || null);
  }
}

// Logout
export function logout(req, res) {
  try {
    if (authModel.hasOpenCashDrawer(req.auth.employeeId)) {
      return error(res, 'Close cash drawer before logout', 409, ERROR_CODE.CLOSE_CASH_DRAWER_REQUIRED);
    }
    authModel.loginTransaction(() => {
      authModel.deleteSession(req.auth.sessionId);
      authModel.logActivity({
        id: uuid(),
        employeeId: req.auth.employeeId,
        action: ACTIVITY_ACTION.LOGOUT,
        entityType: 'auth_session',
        entityId: req.auth.sessionId,
      });
      outboxHooks.queueCashierLog({
        action: ACTIVITY_ACTION.LOGOUT,
        employeeId: req.auth.employeeId,
        actorUserId: req.auth.userId ?? null,
        actorRole: req.auth.role ?? null,
        entityType: 'auth_session',
        entityId: req.auth.sessionId,
      });
    });
    clearAuthCookie(res);
    return success(res, { loggedOut: true });
  } catch (err) {
    return error(res, err.message || 'Logout failed', err.statusCode || 500, err.code || null);
  }
}

// Me
export function me(req, res) {
  try {
    const employee = authModel.findEmployeeById(req.auth.employeeId);
    if (!employee || !employee.isActive) return error(res, 'Unauthorized', 401);
    const session = authModel.findSessionById(req.auth.sessionId);
    if (!session) return error(res, 'Unauthorized', 401);
    return success(res, {
      employee: publicEmployee(employee),
      session: {
        id: session.id,
        syncOk: session.syncOk === 1,
        isLocked: session.isLocked === 1,
        lastSyncedAt: session.lastSyncedAt,
        expiresAt: session.expiresAt,
      },
      cashDrawerOpen: authModel.hasOpenCashDrawer(employee.id),
      idleMinutes: config.idleMinutes,
    });
  } catch (err) {
    return error(res, err.message || 'Failed to load profile', 500);
  }
}

// PATCH /auth/me — self-update name + email only
export function updateMe(req, res) {
  try {
    const employee = authModel.findEmployeeById(req.auth.employeeId);
    if (!employee || !employee.isActive) return error(res, 'Unauthorized', 401);

    const name =
      req.body.name !== undefined ? String(req.body.name).trim() : employee.name;
    const email =
      req.body.email !== undefined
        ? req.body.email == null || String(req.body.email).trim() === ''
          ? null
          : String(req.body.email).trim()
        : employee.email;

    if (!name) return error(res, 'Name is required', 400);

    const updated = authModel.updateProfile(employee.id, { name, email });
    return success(res, { employee: publicEmployee(updated) });
  } catch (err) {
    return error(res, err.message || 'Failed to update profile', err.statusCode || 500);
  }
}

// Lock
export function lock(req, res) {
  try {
    authModel.loginTransaction(() => {
      authModel.setSessionLocked(req.auth.sessionId, true);
      authModel.logActivity({
        id: uuid(),
        employeeId: req.auth.employeeId,
        action: ACTIVITY_ACTION.LOCK,
        entityType: 'auth_session',
        entityId: req.auth.sessionId,
      });
      notificationModel.insert({
        id: uuid(),
        employeeId: req.auth.employeeId,
        source: NOTIFICATION_SOURCE.SYSTEM,
        audience: req.auth.role === 'admin' ? NOTIFICATION_AUDIENCE.ADMIN : NOTIFICATION_AUDIENCE.CASHIER,
        title: 'Session locked',
        body: 'POS locked. Unlock with PIN or password.',
      });
    });
    return success(res, { isLocked: true });
  } catch (err) {
    return error(res, err.message || 'Lock failed', 500);
  }
}

// Unlock (password only — PIN unlock removed)
export function unlock(req, res) {
  try {
    const { value } = req.body;
    const employee = authModel.findEmployeeById(req.auth.employeeId);
    if (!employee || !employee.isActive) return error(res, 'Unauthorized', 401);
    if (!value) return error(res, 'Password is required', 400);
    const ok = passwordMatches(value, employee.passwordHash);
    if (!ok) return error(res, 'Invalid credentials', 401);
    authModel.loginTransaction(() => {
      authModel.setSessionLocked(req.auth.sessionId, false);
      authModel.logActivity({
        id: uuid(),
        employeeId: req.auth.employeeId,
        action: ACTIVITY_ACTION.UNLOCK,
        entityType: 'auth_session',
        entityId: req.auth.sessionId,
      });
    });
    return success(res, { isLocked: false });
  } catch (err) {
    return error(res, err.message || 'Unlock failed', 500);
  }
}
