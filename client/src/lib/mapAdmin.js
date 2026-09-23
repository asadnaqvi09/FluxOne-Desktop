import { parseApiDate } from '@/api/result'
import { mapApiProduct } from '@/lib/mapProduct'
import { adminLogStats } from '@/data/adminLogs'

// Initials from display name
export function initialsFromName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

// Parse log details
function parseDetails(raw) {
  if (raw == null || raw === '') return null
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(String(raw))
  } catch {
    return null
  }
}

// Format log detail
function formatLogDetail(row, details) {
  if (details) {
    if (details.cashierName) {
      return `Assigned cashier ${details.cashierName}`
    }
    if (details.name && details.price != null) {
      return `${details.name} price set to ${details.price}`
    }
    if (details.name) {
      return `${details.name} price/discount updated`
    }
    if (details.sku) return String(details.sku)
  }
  if (row.details && typeof row.details === 'string' && !details) {
    return row.details
  }
  return row.action || '—'
}

// Activity log row → UI table shape
export function mapAdminLog(row) {
  if (!row) return null
  const details = parseDetails(row.details)
  const at = parseApiDate(row.createdAt) || new Date()
  return {
    id: row.id,
    at: at.getTime(),
    actorId: row.actorUserId || row.actorId || '',
    actorEmployeeId: row.actorId || '',
    actorName: row.actorName || '—',
    actorRole: row.actorRole || '',
    action: row.action || '',
    reference: row.entityId || details?.sku || details?.cashierUserId || '—',
    detail: formatLogDetail(row, details),
  }
}

export function mapAdminLogs(logs = []) {
  return logs.map(mapAdminLog).filter(Boolean)
}

// Client-side action / cashier filters (date range is server-side)
export function filterMappedLogs(logs, { action = '', cashierId = '' } = {}) {
  return (logs || []).filter((l) => {
    if (action && l.action !== action) return false
    if (cashierId) {
      const match =
        l.actorId === cashierId ||
        l.actorEmployeeId === cashierId
      if (!match) return false
    }
    return true
  })
}

export { adminLogStats }

  // Admin product list/detail → ItemTable / edit dialog shape
export function mapAdminProduct(product) {
  const base = mapApiProduct(product)
  if (!base) return null
  return {
    ...base,
    category: product.categoryName || product.categoryId || '',
    subCategory: product.subcategoryName || '',
    categoryId: product.categoryId,
    subcategoryId: product.subcategoryId || '',
    discountPct: Number(product.discount ?? base.discountPct) || 0,
    taxRuleIds: (product.taxes || []).map((t) => t.id).filter(Boolean),
  }
}

export function mapAdminProducts(items = []) {
  return items.map(mapAdminProduct).filter(Boolean)
}

// Build category filter options from admin product rows
// (admin has no GET /categories — derive from catalog rows).
export function buildAdminCategoryOptions(products = []) {
  const byId = new Map()
  for (const p of products) {
    if (!p.categoryId) continue
    if (!byId.has(p.categoryId)) {
      byId.set(p.categoryId, {
        id: p.categoryId,
        name: p.category || p.categoryId,
        subs: [],
        _subIds: new Set(),
      })
    }
    const cat = byId.get(p.categoryId)
    if (p.subcategoryId && !cat._subIds.has(p.subcategoryId)) {
      cat._subIds.add(p.subcategoryId)
      cat.subs.push({
        id: p.subcategoryId,
        name: p.subCategory || p.subcategoryId,
      })
    }
  }
  return [...byId.values()]
    .map(({ _subIds, ...rest }) => rest)
    .sort((a, b) => a.name.localeCompare(b.name))
}

// UI filter args → admin products query
export function buildAdminProductParams({
  query = '',
  categoryId = '',
  sub = '',
  page = 1,
  pageSize = 8,
} = {}) {
  const params = {
    page: page || 1,
    pageSize: pageSize || 8,
  }
  const q = String(query || '').trim()
  if (q) params.q = q
  if (categoryId && categoryId !== 'popular' && categoryId !== 'all') {
    params.category = categoryId
  }
  if (sub) params.subcategory = sub
  return params
}

// Match UI tax rates (0.17) to tax rule ids (rate 17)
export function resolveTaxRuleIds(taxRules = [], tax1Rate, tax2Rate) {
  const ids = []
  const rules = taxRules || []
  const targets = [Number(tax1Rate) || 0, Number(tax2Rate) || 0]
  for (const frac of targets) {
    if (!frac) continue
    const pct = Math.round(frac * 10000) / 100
    const match = rules.find(
      (r) => Math.abs(Number(r.rate) - pct) < 0.001,
    )
    if (match?.id) ids.push(match.id)
  }
  return ids
}

// Map employee row to UI shape
export function mapEmployee(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.userId || row.id,
    name: row.name || '',
    role: row.role || '',
    email: row.email || '—',
    pictureUrl: row.pictureUrl || null,
    isActive: row.isActive !== false,
    initials: initialsFromName(row.name),
    assignedAt: row.assignedAt || null,
    assignedBy: row.assignedBy || null,
    assignedByName: row.assignedByName || null,
  }
}

// Map employees list to UI shape
export function mapEmployees(list = []) {
  return list.map(mapEmployee).filter(Boolean)
}

// Store profile API ↔ Invoice Details form
// API: name, contactPhone, contactEmail, address, warningMessage, returnInstructions
// UI:  name, branch, phone, address, warning, returnInstructions
export function mapStoreProfileToForm(store) {
  if (!store) {
    return {
      name: '',
      branch: '',
      address: '',
      phone: '',
      warning: '',
      returnInstructions: '',
    }
  }
  return {
    name: store.name || '',
    branch: store.contactEmail || '',
    address: store.address || '',
    phone: store.contactPhone || '',
    warning: store.warningMessage || '',
    returnInstructions: store.returnInstructions || '',
  }
}

// Map form to store profile patch
export function mapFormToStoreProfilePatch(form) {
  return {
    name: String(form.name || '').trim(),
    contactPhone: String(form.phone || '').trim(),
    contactEmail: String(form.branch || '').trim(),
    address: String(form.address || '').trim(),
    warningMessage: String(form.warning || '').trim(),
    returnInstructions: String(form.returnInstructions || '').trim(),
  }
}
