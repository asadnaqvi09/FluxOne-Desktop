import { connectDb } from '../../config/database.js';
import { error } from '../utils/response.js';
import { ERROR_CODE } from '../../config/constants.js';
import * as syncMetaModel from '../../models/syncMeta.model.js';

/** Active catalog rows — used as a soft “has cached catalog” check. */
export function hasCachedCatalog() {
  const db = connectDb();
  const row = db
    .prepare(
      `
      SELECT COUNT(*) AS n
      FROM products
      WHERE is_active = 1
    `
    )
    .get();
  return Number(row?.n || 0) > 0;
}

/**
 * Selling is allowed after first bootstrap when catalog is cached locally.
 * Cloud does NOT need to be online.
 */
export function isSyncReady() {
  const meta = syncMetaModel.getSyncMeta();
  if (!meta?.bootstrapDone) return false;
  return hasCachedCatalog() || Boolean(meta.branchId);
}

export function requireSync(req, res, next) {
  // Catalog must be cached AND this auth session must be sync-ok
  // (login sets sync_ok=1 inside the 24h window; otherwise cashier must POST /sync).
  if (!isSyncReady() || !req.auth?.syncOk) {
    return error(
      res,
      'Sync required before opening the cash drawer',
      403,
      ERROR_CODE.SYNC_REQUIRED
    );
  }
  return next();
}
