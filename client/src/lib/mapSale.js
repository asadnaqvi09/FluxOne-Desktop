import { toStoreTime } from '@/api/result'
import { normalizeStoreForSlip } from '@/lib/mapInvoice'

function mapGivenLine(line) {
  if (!line) return null
  return {
    id: line.id,
    productId: line.productId,
    name: line.name,
    sku: line.sku,
    qty: Number(line.qty) || 0,
    unitPrice: Number(line.unitPrice) || 0,
    discount: Number(line.discount) || 0,
    tax: Number(line.tax) || 0,
    lineTotal: Number(line.lineTotal) || 0,
  }
}

// Server cart line → UI cart line (discount = absolute per-unit amount)
export function mapSaleItem(item) {
  if (!item) return null
  const discount = Number(item.discount) || 0
  const unitPrice = Number(item.unitPrice) || 0
  return {
    lineId: item.id,
    productId: item.productId,
    name: item.name,
    sku: item.sku,
    emoji: '🛒',
    qty: Number(item.qty) || 0,
    unitPrice,
    discount,
    discountAmt: discount,
    actualPrice: unitPrice,
    returned: false,
    kept: Boolean(item.kept),
  }
}

// Server publicTab → UI sale tab
export function mapSaleTab(tab) {
  if (!tab) return null
  const items = (tab.items || []).map(mapSaleItem).filter(Boolean)
  const isExchange = tab.mode === 'exchange'
  const given = (tab.given || []).map(mapGivenLine).filter(Boolean)
  return {
    id: tab.id,
    label: `Sale ${tab.tabIndex ?? ''}`.trim(),
    seq: tab.tabIndex,
    status: tab.status,
    mode: tab.mode,
    cart: items,
    exchangeMode: isExchange
      ? {
          invoiceId: tab.exchangeInvoiceId,
          exchangedCredit: Number(tab.exchangedCredit) || 0,
          exchangedFingerprint: tab.exchangedFingerprint || null,
          exchangedItemIds: Array.isArray(tab.exchangedItemIds)
            ? tab.exchangedItemIds
            : [],
          given,
        }
      : null,
    itemCount: tab.itemCount ?? items.length,
    exchangedCredit: Number(tab.exchangedCredit) || 0,
  }
}

export function mapSaleTabs(tabs = []) {
  // Open tabs always display as Sale 1..N (fresh after login / drawer open).
  return tabs
    .map(mapSaleTab)
    .filter(Boolean)
    .map((tab, index) => ({
      ...tab,
      label: `Sale ${index + 1}`,
      seq: index + 1,
    }))
}

// Server GET .../totals → BillTotals / CashPay shape
export function mapSaleTotals(data) {
  if (!data) {
    return {
      actual: 0,
      after: 0,
      discount: 0,
      tax1: 0,
      tax2: 0,
      tax: 0,
      total: 0,
      taxes: [],
      exchangedCredit: 0,
      netDue: 0,
      mode: 'sale',
      active: [],
      subtotal: 0,
    }
  }
  const taxes = Array.isArray(data.taxes) ? data.taxes : []
  const tax1 = Number(taxes[0]?.amount) || 0
  const tax2 = Number(taxes[1]?.amount) || 0
  const after = Number(data.afterDiscount) || 0
  const total = Number(data.total) || 0
  return {
    actual: Number(data.actual) || 0,
    after,
    discount: Math.max(0, (Number(data.actual) || 0) - after),
    tax1,
    tax2,
    tax: Number(data.taxTotal) || tax1 + tax2,
    total,
    taxes,
    exchangedCredit: Number(data.exchangedCredit) || 0,
    netDue: Number(data.netDue ?? data.total) || 0,
    mode: data.mode || 'sale',
    tabId: data.tabId,
    active: [],
    subtotal: after,
  }
}

// Checkout API payload → ReceiptSlip / PosContext invoice shape.
// API: invoice, items, taxes, store
// UI: id, createdAt, cashier, cashierId, customer, items, actual, discount, subtotal, tax1, tax2, tax, total, payments, tendered, change, type, paymentStatus, status, history, exchangeHistory, cashRefunded, store
export function mapCheckoutReceipt(data, { cashierName, cashierId } = {}) {
  const invoice = data?.invoice || {}
  const items = data?.items || data?.print?.items || []
  const taxes = data?.taxes || []
  const store = normalizeStoreForSlip(data?.store || data?.print?.store)

  return {
    id: invoice.id || data?.print?.invoiceId,
    createdAt: toStoreTime(invoice.createdAt || data?.print?.createdAt),
    cashier: cashierName || 'Cashier',
    cashierId: cashierId || invoice.employeeId || '',
    customer: 'Walk-in Customer',
    items: items.map((i) => ({
      lineId: i.id,
      productId: i.productId,
      name: i.name,
      sku: i.sku,
      qty: Number(i.qty) || 0,
      unitPrice: Number(i.unitPrice) || 0,
      returned: Boolean(i.isReturned || i.returned),
    })),
    actual:
      Number(invoice.subtotal ?? data?.print?.subtotal ?? 0) +
      Number(invoice.discount ?? data?.print?.discount ?? 0),
    discount: Number(invoice.discount ?? data?.print?.discount) || 0,
    subtotal: Number(invoice.subtotal ?? data?.print?.subtotal) || 0,
    tax1: Number(taxes[0]?.amount) || 0,
    tax2: Number(taxes[1]?.amount) || 0,
    tax: Number(invoice.tax ?? data?.print?.tax) || 0,
    total: Number(invoice.total ?? data?.print?.total) || 0,
    payments: [
      {
        method: 'Cash',
        amount: Number(invoice.total ?? data?.print?.total) || 0,
      },
    ],
    tendered: Number(invoice.tendered ?? data?.print?.tendered) || 0,
    change: Number(invoice.changeDue ?? data?.print?.changeDue) || 0,
    type: invoice.type || data?.print?.type || 'Sale',
    paymentStatus: invoice.paymentStatus || data?.print?.paymentStatus || 'Paid',
    status: invoice.paymentStatus || 'Paid',
    history: [],
    exchangeHistory: [],
    cashRefunded: 0,
    store,
  }
}
