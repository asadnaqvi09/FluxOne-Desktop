import jwt from 'jsonwebtoken';
import config from '../../config/index.js';

/** Safe employee fields for API responses (no password/pin hashes). */
export function publicEmployee(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    role: row.role,
    email: row.email || null,
    pictureUrl: row.pictureUrl,
    ...(row.isActive !== undefined
      ? { isActive: Boolean(row.isActive) }
      : {}),
  };
}

/** Seconds until SQLite expires_at (TEXT) — used as JWT expiresIn. */
export function remainingSeconds(expiresAt) {
  const ms = Date.parse(expiresAt.replace(' ', 'T') + 'Z') - Date.now();
  return Math.max(Math.floor(ms / 1000), 1);
}

/** Single POS JWT (sid = auth_sessions.id). No access/refresh pair. */
export function signToken({ sessionId, employeeId, role, userId, expiresAt }) {
  return jwt.sign(
    { sid: sessionId, eid: employeeId, role, userId },
    config.jwtSecret,
    { expiresIn: remainingSeconds(expiresAt) }
  );
}

/** Login / session response shape for the client. */
export function authPayload(employee, session, token) {
  return {
    token,
    expiresAt: session.expiresAt,
    idleMinutes: config.idleMinutes,
    employee: publicEmployee(employee),
    session: {
      id: session.id,
      // Set at login: 1 when still inside 24h window + catalog ready; else 0 (Sync required).
      syncOk: session.syncOk === 1,
      isLocked: session.isLocked === 1,
      lastSyncedAt: session.lastSyncedAt,
    },
  };
}
