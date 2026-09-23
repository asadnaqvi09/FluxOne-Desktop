import { toStoreTime } from '@/api/result'

// API store_profile → ReceiptSlip fields.
// Accepts either API keys (contactPhone, warningMessage) or UI keys (phone, warning).
export function normalizeStoreForSlip(store) {
  if (!store) return null
  return {
    name: store.name || '',
    branch: store.branch || store.contactEmail || '',
    address: store.address || '',
    phone: store.phone || store.contactPhone || '',
    warning: store.warning || store.warningMessage || '',
    returnInstructions: store.returnInstructions || '',
  }
}

/**
 * Cloud sync currently packs printable policies into return_instructions as:
 *   "Policy Name: body line…\nmore body\n\nNext Policy: …"
 * Parse into structured rows for the invoice slip.
 */
export function parsePoliciesFromReturnInstructions(text) {
  if (!text || typeof text !== 'string') return []
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const idx = block.indexOf(':')
      if (idx <= 0) return { name: '', description: block }
      return {
        name: block.slice(0, idx).trim(),
        description: block
          .slice(idx + 1)
          .trim()
          .replace(/\s*\n\s*/g, ' '),
      }
    })
    .filter((p) => p.name || p.description)
}

/** Middot title list synced into warning_message when policies are printable. */
export function isPolicyTitleList(warning, policies = []) {
  if (!warning || !policies.length) return false
  return String(warning).includes(' · ')
}

// List row — items is a comma-separated name string from the server
export function mapInvoiceListRow(row) {
  if (!row) return null
  const itemsSummary =
    typeof row.items === 'string'
      ? row.items
      : Array.isArray(row.items)
        ? row.items.map((i) => i.name).filter(Boolean).join(', ')
        : ''
  return {
    id: row.id,
    createdAt: toStoreTime(row.createdAt),
    itemCount: Number(row.itemCount) || 0,
    itemsSummary,
    items: itemsSummary,
    subtotal: Number(row.subtotal) || 0,
    discount: Number(row.discount) || 0,
    tax: Number(row.tax) || 0,
    total: Number(row.total) || 0,
    type: row.type || 'Sale',
    paymentStatus: displayPaymentStatus(row.paymentStatus),
  }
}

/** Table/UI: return invoices show Refund (type stays Return). Exchange stays Adjust. */
export function displayPaymentStatus(status) {
  if (status === 'Return') return 'Refund'
  return status || 'Paid'
}

export function mapInvoiceItem(item) {
  if (!item) return null
  return {
    id: item.id,
    lineId: item.id,
    productId: item.productId,
    sku: item.sku,
    name: item.name,
    qty: Number(item.qty) || 0,
    unitPrice: Number(item.unitPrice) || 0,
    discount: Number(item.discount) || 0,
    tax: Number(item.tax) || 0,
    lineTotal: Number(item.lineTotal) || 0,
    returned: Boolean(item.isReturned || item.returned),
  }
}

// GET /invoices/:id → UI detail shape
export function mapInvoiceDetail(data) {
  if (!data?.invoice) return null
  const invoice = data.invoice
  const items = (data.items || []).map(mapInvoiceItem).filter(Boolean)
  const taxes = data.taxes || []
  const history = (data.history || []).map((h) => ({
    id: h.id,
    at: toStoreTime(h.createdAt),
    text: h.text || '',
    actorId: h.actorId,
  }))

  return {
    id: invoice.id,
    createdAt: toStoreTime(invoice.createdAt),
    itemCount: Number(invoice.itemCount) || items.length,
    items,
    itemsSummary: items
      .filter((i) => !i.returned)
      .map((i) => i.name)
      .join(', '),
    subtotal: Number(invoice.subtotal) || 0,
    discount: Number(invoice.discount) || 0,
    tax: Number(invoice.tax) || 0,
    tax1: Number(taxes[0]?.amount) || 0,
    tax2: Number(taxes[1]?.amount) || 0,
    total: Number(invoice.total) || 0,
    type: invoice.type || 'Sale',
    paymentStatus: displayPaymentStatus(invoice.paymentStatus),
    status: displayPaymentStatus(invoice.paymentStatus),
    tendered: Number(invoice.tendered) || 0,
    change: Number(invoice.changeDue) || 0,
    netDue: Number(invoice.netDue) || 0,
    cashDrawerId: invoice.cashDrawerId || null,
    cashierId: invoice.employeeId || '',
    cashier: invoice.employeeName || invoice.employeeId || 'Cashier',
    customer: 'Walk-in Customer',
    payments: [
      {
        method: 'Cash',
        amount: Number(invoice.total) || 0,
      },
    ],
    history,
    store: normalizeStoreForSlip(data.store),
    cashRefunded: 0,
    exchangeHistory: [],
  }
}

// Print / reprint payload → ReceiptSlip shape
export function mapInvoicePrint(data, { cashierName, cashierId } = {}) {
  const print = data?.print || {}
  const invoice = data?.invoice || {}
  const items = (data?.items || print.items || []).map(mapInvoiceItem).filter(Boolean)
  const taxes = data?.taxes || []
  const store = normalizeStoreForSlip(data?.store || print.store)

  return {
    id: print.invoiceId || invoice.id,
    createdAt: toStoreTime(print.createdAt || invoice.createdAt),
    cashier: cashierName || 'Cashier',
    cashierId: cashierId || invoice.employeeId || '',
    customer: 'Walk-in Customer',
    items,
    actual:
      Number(print.subtotal ?? invoice.subtotal ?? 0) +
      Number(print.discount ?? invoice.discount ?? 0),
    discount: Number(print.discount ?? invoice.discount) || 0,
    subtotal: Number(print.subtotal ?? invoice.subtotal) || 0,
    tax1: Number(taxes[0]?.amount) || 0,
    tax2: Number(taxes[1]?.amount) || 0,
    tax: Number(print.tax ?? invoice.tax) || 0,
    total: Number(print.total ?? invoice.total) || 0,
    payments: [
      {
        method: 'Cash',
        amount: Number(print.total ?? invoice.total) || 0,
      },
    ],
    tendered: Number(print.tendered ?? invoice.tendered) || 0,
    change: Number(print.changeDue ?? invoice.changeDue) || 0,
    type: print.type || invoice.type || 'Sale',
    paymentStatus: displayPaymentStatus(
      print.paymentStatus || invoice.paymentStatus,
    ),
    status: displayPaymentStatus(print.paymentStatus || invoice.paymentStatus),
    history: [],
    exchangeHistory: [],
    cashRefunded: 0,
    store,
  }
}

// Return API → ReturnSlipDialog shape
export function mapReturnSlip(data) {
  const refundAmount = Number(data?.refundAmount) || 0
  const returnedItems = (data?.returnedItems || []).map(mapInvoiceItem).filter(Boolean)
  const detail = mapInvoiceDetail({
    invoice: data?.invoice,
    items: data?.items,
    taxes: data?.taxes,
    store: data?.store,
    history: data?.history,
  })
  if (!detail) return null
  return {
    invoice: {
      ...detail,
      cashRefunded: refundAmount,
      store: normalizeStoreForSlip(detail.store) || detail.store,
    },
    lines: returnedItems,
    refundAmount,
  }
}

// GET .../exchanges events → previous-exchange dialog
export function mapExchangeEvents(events = []) {
  return events.map((e) => ({
    id: e.id,
    at: toStoreTime(e.createdAt),
    net: Number(e.netDue) || 0,
    exchangedCredit: Number(e.exchangedCredit) || 0,
    replacementTotal: Number(e.replacementTotal) || 0,
    given: (e.given || []).map((line) => ({
      name: line.name,
      sku: line.sku,
      qty: Number(line.qty) || 0,
    })),
    received: (e.received || []).map((line) => ({
      name: line.name,
      sku: line.sku,
      qty: Number(line.qty) || 0,
    })),
  }))
}

// UI filter hours (`9`) → API `09:00`
export function hourToApiTime(hour) {
  if (hour === '' || hour == null) return undefined
  const raw = String(hour).trim()
  if (/^\d{2}:\d{2}/.test(raw)) return raw.slice(0, 5)
  const n = Number(raw)
  if (Number.isNaN(n)) return undefined
  return `${String(n).padStart(2, '0')}:00`
}

// UI filters → GET /invoices query
export function buildInvoiceListParams({
  q,
  day,
  hourFrom,
  hourTo,
} = {}) {
  const params = {}
  const query = (q || '').trim()
  if (query) params.q = query
  if (day) params.date = day
  let tf = hourToApiTime(hourFrom)
  let tt = hourToApiTime(hourTo)
  if (tf && tt && tf > tt) {
    const swap = tf
    tf = tt
    tt = swap
  }
  if (tf) params.timeFrom = tf
  if (tt) params.timeTo = tt
  return params
}

// Net revenue sign — Returns subtract; Sales/Exchange add header total.
function signedInvoiceTotal(inv) {
  const total = Number(inv.total) || 0
  if ((inv.type || 'Sale') === 'Return') return -total
  return total
}

// Map invoice list to stats
export function invoiceStatsFromList(invoices) {
  const list = invoices || []
  const netRevenue = list.reduce((s, i) => s + signedInvoiceTotal(i), 0)
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const todaySales = list
    .filter((i) => {
      const at = i.createdAt instanceof Date ? i.createdAt : new Date(i.createdAt)
      return at >= start
    })
    .reduce((s, i) => s + signedInvoiceTotal(i), 0)
  return {
    totalRevenue: netRevenue,
    count: list.length,
    avgInvoice: list.length ? netRevenue / list.length : 0,
    todaySales,
  }
}
