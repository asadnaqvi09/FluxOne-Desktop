/** Safe invoice line for API / print. */
export function publicItem(row) {
  return {
    id: row.id,
    productId: row.productId,
    sku: row.sku,
    name: row.name,
    qty: row.qty,
    unitPrice: row.unitPrice,
    discount: row.discount,
    tax: row.tax,
    lineTotal: row.lineTotal,
    isReturned: Boolean(row.isReturned),
  };
}

/** Safe invoice row for list / table UI. */
export function publicInvoiceRow(row) {
  return {
    id: row.id,
    createdAt: row.createdAt,
    itemCount: row.itemCount,
    // Table "Items" column — comma-separated names
    items: row.items || '',
    subtotal: row.subtotal,
    discount: row.discount,
    tax: row.tax,
    total: row.total,
    type: row.type,
    paymentStatus: row.paymentStatus,
  };
}

/** Print / reprint slip payload (also used by return & exchange). */
export function printPayload(bundle, extras = {}) {
  const invoice = bundle.invoice;
  return {
    invoiceId: invoice.id,
    type: invoice.type,
    paymentStatus: invoice.paymentStatus,
    createdAt: invoice.createdAt,
    items: bundle.items.map(publicItem),
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    tax: invoice.tax,
    total: invoice.total,
    tendered: invoice.tendered,
    changeDue: invoice.changeDue,
    netDue: invoice.netDue,
    store: bundle.store,
    ...extras,
  };
}
