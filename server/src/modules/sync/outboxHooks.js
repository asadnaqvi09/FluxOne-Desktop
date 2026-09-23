import { randomUUID } from 'node:crypto';
import * as authModel from '../../models/auth.model.js';
import * as syncOutboxModel from '../../models/syncOutbox.model.js';
import * as syncMetaModel from '../../models/syncMeta.model.js';
import {
  mapActivityToCashierLog,
  mapInvoiceToSaleEvent,
  mapProductPriceUpdateEvent,
  mapRefundEvent,
} from './eventMappers.js';

function resolveDeviceId() {
  return syncMetaModel.getSyncMeta()?.deviceId || 'unprovisioned';
}

function resolveBranchId() {
  return syncMetaModel.getSyncMeta()?.branchId || null;
}

function resolveActor(employeeId, overrides = {}) {
  const employee =
    overrides.employee ||
    (employeeId ? authModel.findEmployeeById(employeeId) : null);
  return {
    actorUserId: overrides.actorUserId ?? employee?.userId ?? null,
    actorName: overrides.actorName ?? employee?.name ?? null,
    actorRole: overrides.actorRole ?? employee?.role ?? null,
  };
}

export function buildClientEventId(...parts) {
  const base = parts.filter(Boolean).join('-');
  return `pos-${base}-${Date.now()}`;
}

export function queueSaleEvent({
  invoice,
  items,
  taxes = [],
  employee,
  counter = null,
  extra = {},
  clientEventSuffix = 'sale',
}) {
  const payload = mapInvoiceToSaleEvent(invoice, items, employee, counter, {
    taxes,
    ...extra,
  });
  syncOutboxModel.insertOutboxEvent({
    clientEventId: buildClientEventId(invoice.id, clientEventSuffix),
    eventType: 'sale',
    payload,
    deviceId: resolveDeviceId(),
  });
}

export function queueRefundEvent({
  invoice,
  returnedItems,
  refundAmount,
  employee,
  counter = null,
  extra = {},
  clientEventSuffix = 'refund',
}) {
  const payload = mapRefundEvent({
    invoice,
    returnedItems,
    refundAmount,
    employee,
    counter,
    extra,
  });
  syncOutboxModel.insertOutboxEvent({
    clientEventId: buildClientEventId(invoice.id, clientEventSuffix),
    eventType: 'refund',
    payload,
    deviceId: resolveDeviceId(),
  });
}

export function queueCashierLog({
  action,
  employeeId,
  employee = null,
  actorUserId = null,
  actorName = null,
  actorRole = null,
  entityType,
  entityId,
  details,
  createdAt,
}) {
  const actor = resolveActor(employeeId, {
    employee,
    actorUserId,
    actorName,
    actorRole,
  });
  const deviceId = resolveDeviceId();
  const payload = mapActivityToCashierLog({
    action,
    employeeId,
    ...actor,
    entityType,
    entityId,
    details,
    createdAt,
    branchId: resolveBranchId(),
    deviceId,
  });
  syncOutboxModel.insertOutboxEvent({
    clientEventId: buildClientEventId(employeeId, action, randomUUID().slice(0, 8)),
    eventType: 'cashier_log',
    payload,
    deviceId,
  });
}

/**
 * Queue catalog price write for cloud (POST /sync/push product_price_update).
 * clientEventId shape: pos-price-<productId>-<timestamp>
 */
export function queueProductPriceUpdate({
  productId,
  sellingPrice,
  discountPercent = 0,
  updatedByUserId = null,
}) {
  const branchId = resolveBranchId();
  if (!branchId) {
    throw Object.assign(new Error('Branch not provisioned — cannot queue price update'), {
      statusCode: 400,
      code: 'BRANCH_REQUIRED',
    });
  }
  if (!productId) {
    throw Object.assign(new Error('productId is required for price update'), {
      statusCode: 400,
      code: 'PRODUCT_REQUIRED',
    });
  }

  const deviceId = resolveDeviceId();
  const payload = mapProductPriceUpdateEvent({
    productId,
    branchId,
    sellingPrice,
    discountPercent,
    updatedByUserId,
    deviceId,
    source: 'pos_items_rate',
  });

  syncOutboxModel.insertOutboxEvent({
    clientEventId: buildClientEventId('price', productId),
    eventType: 'product_price_update',
    payload,
    deviceId,
  });
}

export function queueExchangeEvents({
  invoice,
  exchangedLines,
  receivedLines,
  exchangedCredit,
  replacementTotal,
  netDue,
  tendered,
  changeDue,
  taxes = [],
  employee,
  counter = null,
}) {
  if (exchangedLines?.length && Number(exchangedCredit) > 0) {
    queueRefundEvent({
      invoice,
      returnedItems: exchangedLines,
      refundAmount: exchangedCredit,
      employee,
      counter,
      clientEventSuffix: 'exchange-refund',
      extra: { reason: 'exchange_given' },
    });
  }

  if (receivedLines?.length) {
    queueSaleEvent({
      invoice: {
        ...invoice,
        type: 'Exchange',
        total: replacementTotal,
        tendered: netDue > 0 ? tendered : 0,
        changeDue,
        netDue,
      },
      items: receivedLines,
      taxes,
      employee,
      counter,
      clientEventSuffix: 'exchange-sale',
      extra: {
        exchange: true,
        exchangedCredit,
        replacementTotal,
        metadata: { netDue },
      },
    });
  }
}
