/** Snapshot of an invoice/cart line for exchange given/received payloads. */
export function snapshotLine(line) {
  return {
    id: line.id,
    productId: line.productId,
    sku: line.sku,
    name: line.name,
    qty: line.qty,
    unitPrice: line.unitPrice,
    discount: line.discount,
    tax: line.tax ?? 0,
    lineTotal: line.lineTotal ?? 0,
  };
}
