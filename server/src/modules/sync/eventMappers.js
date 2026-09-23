function resolveCounterCode(counter, invoice) {
  return counter?.code ?? counter?.counterCode ?? invoice?.counterCode ?? null;
}

function mapSaleItems(items = [], { isExchange = false } = {}) {
  return items.map((line) => ({
    invoiceItemId: line.id ?? null,
    productId: line.productId,
    sku: line.sku,
    name: line.name,
    quantity: line.qty,
    unitPrice: line.unitPrice,
    discount: line.discount ?? 0,
    tax: line.tax ?? line.lineTax ?? 0,
    lineTotal: line.lineTotal,
    scale: line.scale ?? line.unitScale ?? 'unit',
    isExchange: isExchange || Boolean(line.isExchange),
  }));
}

export function mapInvoiceToSaleEvent(invoice, items, employee, counter = null, extra = {}) {
  const {
    taxes = [],
    exchange = false,
    exchangedCredit,
    replacementTotal,
    metadata = {},
    ...rest
  } = extra;

  return {
    saleNumber: invoice.id,
    invoiceId: invoice.id,
    type: invoice.type,
    cashierId: employee?.id ?? invoice.employeeId,
    cashierName: employee?.name ?? null,
    counterId: counter?.id ?? invoice.counterId ?? null,
    counterCode: resolveCounterCode(counter, invoice),
    paymentMethod: invoice.paymentMethod ?? 'cash',
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    tax: invoice.tax,
    total: invoice.total,
    tendered: invoice.tendered,
    changeDue: invoice.changeDue,
    netDue: invoice.netDue ?? 0,
    soldAt: invoice.createdAt ?? new Date().toISOString(),
    items: mapSaleItems(items, { isExchange: exchange }),
    taxes,
    exchange,
    exchangedCredit,
    replacementTotal,
    ...metadata,
    ...rest,
  };
}

export function mapRefundEvent({
  invoice,
  returnedItems,
  refundAmount,
  employee,
  counter = null,
  extra = {},
}) {
  const refundedAt = invoice.createdAt ?? new Date().toISOString();

  return {
    saleNumber: invoice.id,
    invoiceId: invoice.id,
    originalInvoiceId: invoice.originalInvoiceId ?? invoice.id,
    refundAmount,
    cashierId: employee?.id ?? invoice.employeeId,
    cashierName: employee?.name ?? null,
    counterId: counter?.id ?? invoice.counterId ?? null,
    counterCode: resolveCounterCode(counter, invoice),
    paymentMethod: invoice.paymentMethod ?? 'cash',
    refundedAt,
    soldAt: refundedAt,
    items: mapSaleItems(returnedItems),
    ...extra,
  };
}

/**
 * Map local activity → cloud cashier_log payload.
 * Cloud BM Logs UI expects actorName / actorRole so it can render
 * "{Person} performed {action} at {time}" without joining POS employee ids.
 */
export function mapActivityToCashierLog({
  action,
  employeeId,
  actorUserId = null,
  actorName = null,
  actorRole = null,
  entityType,
  entityId,
  details,
  createdAt,
  branchId = null,
  deviceId = null,
}) {
  let metadata = details;
  if (typeof details === 'string') {
    try {
      metadata = JSON.parse(details);
    } catch {
      metadata = { raw: details };
    }
  }

  const payload = {
    action,
    employeeId: employeeId ?? null,
    actorUserId: actorUserId ?? null,
    actorName: actorName ?? null,
    actorRole: actorRole ?? null,
    entityType: entityType ?? null,
    entityId: entityId ?? null,
    metadata: metadata ?? {},
    timestamp: createdAt ?? new Date().toISOString(),
  };
  if (branchId) payload.branchId = branchId;
  if (deviceId) payload.deviceId = deviceId;
  return payload;
}

/** POS Items Rate → cloud catalog selling price (Policy A, branch-scoped product). */
export function mapProductPriceUpdateEvent({
  productId,
  branchId,
  sellingPrice,
  discountPercent = 0,
  updatedAt,
  updatedByUserId = null,
  deviceId = null,
  source = 'pos_items_rate',
}) {
  const payload = {
    productId,
    branchId,
    sellingPrice: Number(sellingPrice),
    discountPercent: Number(discountPercent) || 0,
    source,
    updatedAt: updatedAt ?? new Date().toISOString(),
  };
  if (updatedByUserId) payload.updatedByUserId = updatedByUserId;
  if (deviceId) payload.deviceId = deviceId;
  return payload;
}
