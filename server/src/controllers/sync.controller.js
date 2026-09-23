import { v4 as uuid } from 'uuid';
import { ACTIVITY_ACTION, NOTIFICATION_SOURCE, ROLES } from '../config/constants.js';
import { success, error } from '../shared/utils/response.js';
import { isRequestOnline } from '../shared/middlewares/online.middleware.js';
import { isSyncReady } from '../shared/middlewares/sync.middleware.js';
import * as syncModel from '../models/sync.model.js';
import * as syncMetaModel from '../models/syncMeta.model.js';
import * as syncOutboxModel from '../models/syncOutbox.model.js';
import * as cloudClient from '../modules/sync/cloudClient.js';
import { CloudError, CLOUD_ERROR_TYPE, isCloudError } from '../modules/sync/cloudErrors.js';
import * as syncService from '../modules/sync/syncService.js';

function publicMeta(meta) {
  if (!meta) return null;
  return {
    tenantId: meta.tenantId,
    branchId: meta.branchId,
    deviceId: meta.deviceId,
    cloudApiUrl: meta.cloudApiUrl,
    lastPullAt: meta.lastPullAt,
    lastPushAt: meta.lastPushAt,
    bootstrapDone: Boolean(meta.bootstrapDone),
  };
}

function finishSessionSync(req, source, details = {}) {
  const snapshot = syncModel.getCatalogSnapshot();
  return syncModel.runSyncTransaction(() => {
    const session = syncModel.markSessionSynced(req.auth.sessionId);
    const state = syncModel.upsertSyncState(source);
    syncModel.logActivity({
      id: uuid(),
      employeeId: req.auth.employeeId,
      action: ACTIVITY_ACTION.SYNC,
      entityType: 'auth_session',
      entityId: req.auth.sessionId,
      details: JSON.stringify({ source, ...details }),
    });
    // One "Sync completed" per login session — re-syncs (badge / 15m) stay silent
    if (session?.firstSyncOfSession) {
      syncModel.createNotification({
        id: uuid(),
        employeeId: req.auth.employeeId,
        source: NOTIFICATION_SOURCE.SYSTEM,
        title: 'Sync completed',
        body:
          source === 'cloud'
            ? 'Cloud catalog and outbox sync finished.'
            : 'Cached catalog is ready for offline selling.',
      });
    }
    return {
      syncOk: session?.syncOk === 1,
      lastSyncedAt: session?.lastSyncedAt || state?.lastSyncedAt,
      source: state?.source || source,
      ...snapshot,
    };
  });
}

/**
 * POST /api/sync
 * - If bootstrap not done and cloud is configured → pull bootstrap
 * - Else run push + delta cycle when online
 * - Offline after bootstrap → mark session synced from cache (never block selling)
 */
export async function sync(req, res) {
  try {
    const online = isRequestOnline(req);
    const meta = syncMetaModel.getSyncMeta();
    const cloudConfigured = cloudClient.isCloudConfigured();

    if (!meta?.bootstrapDone) {
      if (!cloudConfigured || !meta?.branchId) {
        return error(
          res,
          'Cloud bootstrap required. Complete setup first.',
          409,
          'BOOTSTRAP_REQUIRED'
        );
      }
      if (!online) {
        return error(
          res,
          'Network required for first cloud bootstrap',
          503,
          'OFFLINE'
        );
      }

      try {
        const bootstrap = await syncService.pullBootstrap(meta.branchId);
        const sessionResult = finishSessionSync(req, 'cloud', {
          mode: 'bootstrap',
          counts: bootstrap.counts,
        });
        return success(res, {
          ...sessionResult,
          mode: 'bootstrap',
          pendingOutbox: syncOutboxModel.countPending(),
          failedOutbox: syncOutboxModel.countFailed(),
          pendingByType: syncOutboxModel.countPendingByType(),
          failedEvents: syncOutboxModel.listFailedSummaries(10),
          meta: publicMeta(syncMetaModel.getSyncMeta()),
          bootstrap: bootstrap.counts,
        });
      } catch (err) {
        const status =
          isCloudError(err) && err.type === CLOUD_ERROR_TYPE.AUTH
            ? 401
            : isCloudError(err) && err.type === CLOUD_ERROR_TYPE.NETWORK
              ? 503
              : err.statusCode || 502;
        return error(res, err.message || 'Bootstrap failed', status, err.code || null);
      }
    }

    // Offline after bootstrap: gate session with cached catalog only
    if (!online) {
      if (!isSyncReady()) {
        return error(res, 'Catalog not ready. Sync while online first.', 503, 'OFFLINE');
      }
      const sessionResult = finishSessionSync(req, 'cache', { mode: 'offline_cache' });
      return success(res, {
        ...sessionResult,
        mode: 'offline_cache',
        pendingOutbox: syncOutboxModel.countPending(),
        failedOutbox: syncOutboxModel.countFailed(),
        pendingByType: syncOutboxModel.countPendingByType(),
        failedEvents: syncOutboxModel.listFailedSummaries(10),
        meta: publicMeta(meta),
        push: { reason: 'offline' },
        pull: { reason: 'offline' },
      });
    }

    const cycle = await syncService.runSyncCycle();
    const sessionResult = finishSessionSync(req, 'cloud', {
      mode: 'cycle',
      push: cycle.push,
      pull: cycle.pull,
    });

    return success(res, {
      ...sessionResult,
      mode: 'cycle',
      pendingOutbox: cycle.pendingOutbox,
      failedOutbox: cycle.failedOutbox,
      pendingByType: cycle.pendingByType,
      failedEvents: cycle.failedEvents || [],
      meta: publicMeta(cycle.meta),
      push: cycle.push,
      pull: cycle.pull,
    });
  } catch (err) {
    return error(res, err.message || 'Sync failed', err.statusCode || 500, err.code || null);
  }
}

/** GET /api/sync/status */
export function status(req, res) {
  try {
    const statusPayload = syncService.getSyncStatus();
    const meta = statusPayload.meta;
    return success(res, {
      syncOk: isSyncReady(),
      sessionSyncOk: Boolean(req.auth?.syncOk),
      bootstrapDone: Boolean(meta?.bootstrapDone),
      cloudConfigured: statusPayload.cloudConfigured,
      online: isRequestOnline(req),
      pendingOutbox: statusPayload.pendingOutbox,
      failedOutbox: statusPayload.failedOutbox,
      pendingByType: statusPayload.pendingByType,
      // DEV: remove failedEvents before client delivery
      failedEvents: statusPayload.failedEvents || [],
      lastPullAt: meta?.lastPullAt ?? null,
      lastPushAt: meta?.lastPushAt ?? null,
      meta: publicMeta(meta),
      counts: syncModel.getCatalogSnapshot().counts,
    });
  } catch (err) {
    return error(res, err.message || 'Failed to load sync status', 500);
  }
}

/**
 * POST /api/sync/bootstrap — admin-only re-bootstrap (guarded)
 */
export async function bootstrap(req, res) {
  try {
    if (req.auth?.role !== ROLES.ADMIN) {
      return error(res, 'Forbidden', 403);
    }

    const meta = syncMetaModel.getSyncMeta();
    if (!cloudClient.isCloudConfigured()) {
      return error(res, 'Cloud API URL is not configured', 400, 'CLOUD_NOT_CONFIGURED');
    }

    const branchId = req.body?.branchId || meta?.branchId;
    if (!branchId) {
      return error(res, 'branchId is required for bootstrap', 400, 'BRANCH_ID_REQUIRED');
    }

    if (!isRequestOnline(req)) {
      return error(res, 'Network required for bootstrap', 503, 'OFFLINE');
    }

    if (!meta?.accessToken) {
      return error(res, 'Cloud login required before bootstrap', 401, 'CLOUD_AUTH_REQUIRED');
    }

    syncMetaModel.updateSyncMeta({ branchId });

    const bootstrapResult = await syncService.pullBootstrap(branchId);
    const sessionResult = finishSessionSync(req, 'cloud', {
      mode: 'manual_bootstrap',
      counts: bootstrapResult.counts,
    });

    return success(res, {
      ...sessionResult,
      mode: 'bootstrap',
      bootstrap: bootstrapResult.counts,
      meta: publicMeta(syncMetaModel.getSyncMeta()),
      pendingOutbox: syncOutboxModel.countPending(),
    });
  } catch (err) {
    if (err instanceof CloudError) {
      const status =
        err.type === CLOUD_ERROR_TYPE.AUTH
          ? 401
          : err.type === CLOUD_ERROR_TYPE.NETWORK
            ? 503
            : 502;
      return error(res, err.message, status, err.code || null);
    }
    return error(res, err.message || 'Bootstrap failed', err.statusCode || 500, err.code || null);
  }
}
