import jwt from 'jsonwebtoken';
import config from '../../config/index.js';
import { error } from '../utils/response.js';
import { hashToken } from '../utils/tokenHash.js';
import { AUTH_COOKIE_NAME } from '../utils/authCookie.js';
import * as authModel from '../../models/auth.model.js';

// Prefer Authorization Bearer; fall back to HttpOnly cookie
function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  return cookieToken || null;
}

export function requireAuth(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) return error(res, 'Unauthorized', 401);
    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      return error(res, 'Unauthorized', 401);
    }
    const session = authModel.findActiveSessionById(payload.sid);
    if (!session) return error(res, 'Unauthorized', 401);
    if (session.tokenHash !== hashToken(token)) return error(res, 'Unauthorized', 401);
    // This login session completed Sync (POST /api/sync) — not device bootstrap alone
    const syncOk = session.syncOk === 1;
    req.auth = {
      sessionId: session.id,
      employeeId: session.employeeId,
      role: payload.role,
      userId: payload.userId,
      syncOk,
      isLocked: session.isLocked === 1,
      expiresAt: session.expiresAt,
    };
    req.token = token;
    return next();
  } catch (err) {
    return error(res, err.message || 'Unauthorized', 401);
  }
}

export function requireUnlocked(req, res, next) {
  if (req.auth?.isLocked) return error(res, 'Session is locked', 403);
  return next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth) return error(res, 'Unauthorized', 401);
    if (!roles.includes(req.auth.role)) return error(res, 'Forbidden', 403);
    return next();
  };
}
