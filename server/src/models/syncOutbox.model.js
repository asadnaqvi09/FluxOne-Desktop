import { connectDb } from '../config/database.js';

const OUTBOX_FIELDS = `
  id,
  client_event_id AS clientEventId,
  event_type AS eventType,
  payload,
  device_id AS deviceId,
  created_at AS createdAt,
  synced_at AS syncedAt,
  sync_status AS syncStatus,
  retry_count AS retryCount,
  last_error AS lastError
`;

export function runTx(fn) {
  return connectDb().transaction(fn)();
}

export function insertOutboxEvent({
  clientEventId,
  eventType,
  payload,
  deviceId,
}) {
  const db = connectDb();
  db.prepare(
    `
    INSERT INTO sync_outbox (
      client_event_id, event_type, payload, device_id, sync_status
    ) VALUES (
      @clientEventId, @eventType, @payload, @deviceId, 'pending'
    )
  `
  ).run({
    clientEventId,
    eventType,
    payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
    deviceId,
  });
  return findByClientEventId(clientEventId);
}

export function findByClientEventId(clientEventId) {
  const db = connectDb();
  return (
    db
      .prepare(`SELECT ${OUTBOX_FIELDS} FROM sync_outbox WHERE client_event_id = ?`)
      .get(clientEventId) || null
  );
}

export function listPending(limit = 50) {
  const db = connectDb();
  return db
    .prepare(
      `
    SELECT ${OUTBOX_FIELDS}
    FROM sync_outbox
    WHERE sync_status = 'pending'
    ORDER BY created_at ASC
    LIMIT ?
  `
    )
    .all(limit);
}

export function countPending() {
  const db = connectDb();
  return db
    .prepare(`SELECT COUNT(*) AS n FROM sync_outbox WHERE sync_status = 'pending'`)
    .get().n;
}

export function countFailed() {
  const db = connectDb();
  return db
    .prepare(`SELECT COUNT(*) AS n FROM sync_outbox WHERE sync_status = 'failed'`)
    .get().n;
}

/** Failed uploads for debug UI / support (pre-production). */
export function listFailed(limit = 20) {
  const db = connectDb();
  return db
    .prepare(
      `
    SELECT ${OUTBOX_FIELDS}
    FROM sync_outbox
    WHERE sync_status = 'failed'
    ORDER BY created_at DESC
    LIMIT ?
  `
    )
    .all(limit);
}

/**
 * Move failed → pending so the next push cycle actually retries.
 * (Badge text said "retry on sync" but push only listed pending rows.)
 */
export function requeueFailed() {
  const db = connectDb();
  const result = db
    .prepare(
      `
    UPDATE sync_outbox
    SET sync_status = 'pending'
    WHERE sync_status = 'failed'
  `
    )
    .run();
  return Number(result.changes) || 0;
}

/** Compact rows for GET /sync/status (UI + terminal diagnosis). */
export function listFailedSummaries(limit = 10) {
  return listFailed(limit).map((row) => {
    let invoiceId = null;
    let saleNumber = null;
    try {
      const payload =
        typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
      invoiceId = payload?.invoiceId ?? null;
      saleNumber = payload?.saleNumber ?? payload?.sale_number ?? invoiceId;
    } catch {
      // keep nulls
    }
    return {
      clientEventId: row.clientEventId,
      eventType: row.eventType,
      invoiceId,
      saleNumber,
      retryCount: Number(row.retryCount) || 0,
      lastError: row.lastError || 'Unknown error',
      createdAt: row.createdAt,
    };
  });
}

/** Counts pending outbox rows grouped by event_type (POS → cloud upload queue). */
export function countPendingByType() {
  const db = connectDb();
  const rows = db
    .prepare(
      `
      SELECT event_type AS eventType, COUNT(*) AS n
      FROM sync_outbox
      WHERE sync_status = 'pending'
      GROUP BY event_type
    `
    )
    .all();

  const byType = {
    sale: 0,
    refund: 0,
    cashier_log: 0,
    attendance: 0,
    product_price_update: 0,
  };

  for (const row of rows) {
    const key = row.eventType;
    const n = Number(row.n) || 0;
    if (Object.prototype.hasOwnProperty.call(byType, key)) {
      byType[key] = n;
    } else {
      byType[key] = n;
    }
  }

  return byType;
}

export function markSent(clientEventId) {
  const db = connectDb();
  db.prepare(
    `
    UPDATE sync_outbox
    SET sync_status = 'sent', synced_at = datetime('now'), last_error = NULL
    WHERE client_event_id = ?
  `
  ).run(clientEventId);
}

export function markFailed(clientEventId, errorMessage, { incrementRetry = true } = {}) {
  const db = connectDb();
  if (incrementRetry) {
    db.prepare(
      `
      UPDATE sync_outbox
      SET sync_status = 'failed',
          retry_count = retry_count + 1,
          last_error = @error
      WHERE client_event_id = @clientEventId
    `
    ).run({ clientEventId, error: errorMessage || null });
    return;
  }
  db.prepare(
    `
    UPDATE sync_outbox
    SET sync_status = 'failed', last_error = @error
    WHERE client_event_id = @clientEventId
  `
  ).run({ clientEventId, error: errorMessage || null });
}

export function incrementRetry(clientEventId, errorMessage) {
  const db = connectDb();
  db.prepare(
    `
    UPDATE sync_outbox
    SET retry_count = retry_count + 1, last_error = @error
    WHERE client_event_id = @clientEventId
  `
  ).run({ clientEventId, error: errorMessage || null });
}

export function markInvoiceCloudSynced(invoiceId, cloudSaleId = null) {
  const db = connectDb();
  if (cloudSaleId) {
    db.prepare(
      `
      UPDATE invoices
      SET cloud_synced_at = datetime('now'), cloud_sale_id = @cloudSaleId
      WHERE id = @invoiceId
    `
    ).run({ invoiceId, cloudSaleId });
    return;
  }
  db.prepare(
    `
    UPDATE invoices
    SET cloud_synced_at = datetime('now')
    WHERE id = ?
  `
  ).run(invoiceId);
}
