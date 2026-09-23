import config from '../../config/index.js';
import * as syncMetaModel from '../../models/syncMeta.model.js';
import * as syncOutboxModel from '../../models/syncOutbox.model.js';
import * as cloudClient from './cloudClient.js';
import { CloudError, CLOUD_ERROR_TYPE, isCloudError } from './cloudErrors.js';
import {
  collectAcceptedEventIds,
  collectPushSaleIds,
} from './mappers.js';
import {
  applyCatalogSnapshot,
  applyCloudSales,
  markBootstrapDone,
} from './syncApply.js';

const MAX_OUTBOX_RETRIES = 10;
const SALES_PAGE_LIMIT = 100;

/** Pre-production sync diagnostics — strip or gate before client delivery. */
function syncLog(level, message, extra) {
  const line = `[fluxone:sync] ${message}`;
  if (level === 'error') {
    if (extra !== undefined) console.error(line, extra);
    else console.error(line);
    return;
  }
  if (extra !== undefined) console.log(line, extra);
  else console.log(line);
}

export function isNetworkOnline() {
  return config.isOnline;
}

export function applyBootstrap(data, options = {}) {
  return applyCatalogSnapshot(data, { isBootstrap: true, ...options });
}

export function applyDelta(data) {
  return applyCatalogSnapshot(data, { isBootstrap: false });
}

/**
 * Pull catalog then page-loop sales history before marking bootstrap done.
 * Stock is never adjusted from sales restore.
 */
export async function pullBootstrap(branchId) {
  const resolvedBranchId = branchId || syncMetaModel.getSyncMeta()?.branchId;
  const data = await cloudClient.getBootstrap(resolvedBranchId);
  const counts = applyBootstrap(data, { deferBootstrapDone: true });

  const sales = await pullAllSalesPages(resolvedBranchId);
  const salesStats = applyCloudSales(sales.items);

  markBootstrapDone();

  return {
    counts: {
      ...counts,
      sales: salesStats.applied,
      salesSkippedPending: salesStats.skippedPending,
      salesSkippedInvalid: salesStats.skippedInvalid,
      salesTotal: sales.total,
    },
    sales: salesStats,
    raw: data,
  };
}

async function pullAllSalesPages(branchId) {
  const metaBranchId = branchId || syncMetaModel.getSyncMeta()?.branchId;
  if (!metaBranchId) {
    return { items: [], total: 0, pageCount: 0 };
  }

  const allItems = [];
  let page = 1;
  let pageCount = 1;
  let total = 0;

  while (page <= pageCount) {
    const result = await cloudClient.getSalesPage({
      branchId: metaBranchId,
      page,
      limit: SALES_PAGE_LIMIT,
    });
    const items = Array.isArray(result.items) ? result.items : [];
    allItems.push(...items);

    const pagination = result.pagination || {};
    total = Number(pagination.total) || allItems.length;
    pageCount = Math.max(1, Number(pagination.pageCount) || 1);

    if (items.length === 0 || items.length < SALES_PAGE_LIMIT) {
      break;
    }
    page += 1;
    if (page > pageCount) break;
  }

  return { items: allItems, total, pageCount };
}

export async function pullDelta() {
  const meta = syncMetaModel.getSyncMeta();
  if (!meta?.bootstrapDone) {
    return { pulled: false, reason: 'bootstrap_required' };
  }
  if (!meta.lastPullAt) {
    return { pulled: false, reason: 'missing_last_pull_at' };
  }

  const data = await cloudClient.getDelta(meta.branchId, meta.lastPullAt);
  const counts = applyDelta(data);
  return { pulled: true, counts, raw: data };
}

export async function pushOutbox(batchSize = 50) {
  if (!isNetworkOnline()) {
    return {
      pushed: 0,
      accepted: 0,
      rejected: 0,
      pending: syncOutboxModel.countPending(),
      reason: 'offline',
    };
  }

  // Failed rows were stuck forever — re-queue so "retry on sync" actually works.
  const requeued = syncOutboxModel.requeueFailed();
  if (requeued > 0) {
    syncLog('info', `Re-queued ${requeued} failed outbox event(s) for retry`);
  }

  const pending = syncOutboxModel.listPending(batchSize);
  if (!pending.length) {
    return {
      pushed: 0,
      accepted: 0,
      rejected: 0,
      pending: 0,
      reason: 'empty',
      requeued,
    };
  }

  syncLog(
    'info',
    `Pushing ${pending.length} outbox event(s): ${pending
      .map((r) => `${r.eventType}:${r.clientEventId}`)
      .join(', ')}`,
  );

  const events = pending.map((row) => ({
    clientEventId: row.clientEventId,
    eventType: row.eventType,
    payload: JSON.parse(row.payload),
    deviceId: row.deviceId,
  }));

  try {
    await cloudClient.ensureValidJwt();
  } catch (error) {
    syncLog('error', `Push auth failed: ${error.message}`);
    return {
      pushed: 0,
      accepted: 0,
      rejected: 0,
      pending: syncOutboxModel.countPending(),
      reason: 'auth_failed',
      error: error.message,
      requeued,
    };
  }

  try {
    const result = await cloudClient.pushEvents(events);
    const acceptedIds = collectAcceptedEventIds(result);
    const saleIdsByEvent = collectPushSaleIds(result);
    const rejected = Array.isArray(result.rejected) ? result.rejected : [];

    for (const clientEventId of acceptedIds) {
      syncOutboxModel.markSent(clientEventId);
      const row = pending.find((item) => item.clientEventId === clientEventId);
      const invoiceId = row?.payload ? readInvoiceIdFromPayload(row.payload) : null;
      if (!invoiceId) continue;

      const cloudSaleId = saleIdsByEvent.get(clientEventId) ?? null;
      const isSaleEvent = row?.eventType === 'sale' || row?.eventType === 'refund';
      if (isSaleEvent || cloudSaleId) {
        syncOutboxModel.markInvoiceCloudSynced(invoiceId, cloudSaleId);
      }
    }

    for (const item of rejected) {
      const clientEventId =
        typeof item === 'string' ? item : item.clientEventId ?? item.client_event_id;
      if (!clientEventId) continue;
      const message =
        typeof item === 'string'
          ? 'Rejected by cloud'
          : item.error || item.message || 'Rejected by cloud';
      const row = pending.find((p) => p.clientEventId === clientEventId);
      syncOutboxModel.markFailed(clientEventId, message);
      syncLog('error', `Cloud REJECTED ${row?.eventType || '?'} ${clientEventId}: ${message}`);
    }

    if (acceptedIds.length) {
      syncLog('info', `Cloud accepted ${acceptedIds.length} event(s)`);
    }

    syncMetaModel.updateSyncMeta({ lastPushAt: new Date().toISOString() });

    return {
      pushed: acceptedIds.length,
      accepted: acceptedIds.length,
      rejected: rejected.length,
      pending: syncOutboxModel.countPending(),
      failed: syncOutboxModel.countFailed(),
      requeued,
    };
  } catch (error) {
    return handlePushFailure(pending, error, { requeued });
  }
}

function readInvoiceIdFromPayload(payloadText) {
  try {
    const payload = typeof payloadText === 'string' ? JSON.parse(payloadText) : payloadText;
    return payload?.invoiceId ?? payload?.saleNumber ?? payload?.sale_number ?? null;
  } catch {
    return null;
  }
}

function handlePushFailure(pending, error, { requeued = 0 } = {}) {
  const message = error?.message || 'Cloud push failed';
  const type = isCloudError(error) ? error.type : CLOUD_ERROR_TYPE.SERVER;
  const status = error?.status || 0;

  syncLog('error', `Push batch failed type=${type} status=${status}: ${message}`);

  if (type === CLOUD_ERROR_TYPE.NETWORK) {
    return {
      pushed: 0,
      accepted: 0,
      rejected: 0,
      pending: syncOutboxModel.countPending(),
      reason: 'network',
      error: message,
      requeued,
    };
  }

  if (type === CLOUD_ERROR_TYPE.AUTH) {
    return {
      pushed: 0,
      accepted: 0,
      rejected: 0,
      pending: syncOutboxModel.countPending(),
      reason: 'auth_failed',
      error: message,
      requeued,
    };
  }

  if (type === CLOUD_ERROR_TYPE.VALIDATION || status === 422) {
    for (const row of pending) {
      syncOutboxModel.markFailed(row.clientEventId, message);
      syncLog(
        'error',
        `Marked FAILED (validation) ${row.eventType} ${row.clientEventId}: ${message}`,
      );
    }
    return {
      pushed: 0,
      accepted: 0,
      rejected: pending.length,
      pending: syncOutboxModel.countPending(),
      reason: 'validation',
      error: message,
      requeued,
    };
  }

  if (type === CLOUD_ERROR_TYPE.SERVER || status >= 500) {
    for (const row of pending) {
      const nextRetry = (row.retryCount || 0) + 1;
      if (nextRetry >= MAX_OUTBOX_RETRIES) {
        syncOutboxModel.markFailed(row.clientEventId, message);
        syncLog(
          'error',
          `Marked FAILED (server, max retries) ${row.eventType} ${row.clientEventId}: ${message}`,
        );
      } else {
        syncOutboxModel.incrementRetry(row.clientEventId, message);
        syncLog(
          'info',
          `Retry ${nextRetry}/${MAX_OUTBOX_RETRIES} ${row.eventType} ${row.clientEventId}: ${message}`,
        );
      }
    }
    return {
      pushed: 0,
      accepted: 0,
      rejected: 0,
      pending: syncOutboxModel.countPending(),
      reason: 'server',
      error: message,
      requeued,
    };
  }

  for (const row of pending) {
    syncOutboxModel.incrementRetry(row.clientEventId, message);
  }

  return {
    pushed: 0,
    accepted: 0,
    rejected: 0,
    pending: syncOutboxModel.countPending(),
    reason: 'error',
    error: message,
    requeued,
  };
}

export async function runSyncCycle({ batchSize = 50 } = {}) {
  const meta = syncMetaModel.getSyncMeta();
  const push = await pushOutbox(batchSize);

  let pull = { pulled: false, reason: 'skipped' };
  if (meta?.bootstrapDone && isNetworkOnline()) {
    try {
      pull = await pullDelta();
    } catch (error) {
      if (error instanceof CloudError && error.type === CLOUD_ERROR_TYPE.NETWORK) {
        pull = { pulled: false, reason: 'network', error: error.message };
      } else if (error instanceof CloudError && error.type === CLOUD_ERROR_TYPE.AUTH) {
        pull = { pulled: false, reason: 'auth_failed', error: error.message };
      } else {
        pull = { pulled: false, reason: 'error', error: error.message };
      }
    }
  } else if (!meta?.bootstrapDone) {
    pull = { pulled: false, reason: 'bootstrap_required' };
  } else if (!isNetworkOnline()) {
    pull = { pulled: false, reason: 'offline' };
  }

  const failedOutbox = syncOutboxModel.countFailed();
  const failedEvents = syncOutboxModel.listFailedSummaries(10);
  if (failedOutbox > 0) {
    syncLog(
      'error',
      `Cycle done with ${failedOutbox} failed upload(s). Open Sync badge/page for last_error.`,
    );
    for (const row of failedEvents) {
      syncLog(
        'error',
        `  → ${row.eventType} ${row.saleNumber || row.clientEventId}: ${row.lastError}`,
      );
    }
  }

  return {
    meta: syncMetaModel.getSyncMeta(),
    pendingOutbox: syncOutboxModel.countPending(),
    failedOutbox,
    pendingByType: syncOutboxModel.countPendingByType(),
    // DEV: remove failedEvents from API before client delivery
    failedEvents,
    push,
    pull,
  };
}

export function getSyncStatus() {
  const meta = syncMetaModel.getSyncMeta();
  return {
    meta,
    pendingOutbox: syncOutboxModel.countPending(),
    failedOutbox: syncOutboxModel.countFailed(),
    pendingByType: syncOutboxModel.countPendingByType(),
    // DEV: remove failedEvents from API before client delivery
    failedEvents: syncOutboxModel.listFailedSummaries(10),
    cloudConfigured: cloudClient.isCloudConfigured(),
    online: isNetworkOnline(),
  };
}

export default {
  isNetworkOnline,
  applyBootstrap,
  applyDelta,
  pullBootstrap,
  pullDelta,
  pushOutbox,
  runSyncCycle,
  getSyncStatus,
};
