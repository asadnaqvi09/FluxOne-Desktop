import { TAX1_RATE } from '@/data/products'
import { LOW_STOCK_THRESHOLD } from '@/lib/constants'
import i18n from '@/i18n'

// Build a cart line from a catalog product
export function lineFromProduct(p, qty = 1) {
  const discountPct = p.discountPct || 0
  const actualPrice = p.price
  const discountAmt = Math.round((actualPrice * discountPct) / 100)
  return {
    lineId: `${p.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productId: p.id,
    name: p.name,
    sku: p.sku,
    emoji: p.emoji,
    actualPrice,
    discountPct,
    discountAmt,
    unitPrice: actualPrice - discountAmt,
    tax1Rate: p.tax1Rate ?? TAX1_RATE,
    tax2Rate: p.tax2Rate || 0,
    qty,
    returned: false,
  }
}

// Bill totals — Tax 1 / Tax 2 (N taxes later via taxRates[])
export function cartTotals(items) {
  const active = (items || []).filter((i) => !i.returned && i.qty > 0)
  const actual = active.reduce((s, i) => s + i.actualPrice * i.qty, 0)
  const discount = active.reduce((s, i) => s + (i.discountAmt || 0) * i.qty, 0)
  const after = actual - discount
  const tax1 = Math.round(
    active.reduce((s, i) => s + i.unitPrice * i.qty * (i.tax1Rate || 0), 0),
  )
  const tax2 = Math.round(
    active.reduce((s, i) => s + i.unitPrice * i.qty * (i.tax2Rate || 0), 0),
  )
  return {
    actual,
    discount,
    after,
    tax1,
    tax2,
    tax: tax1 + tax2,
    total: after + tax1 + tax2,
    active,
    subtotal: after,
  }
}

/** Stock tone only — translate display text in UI with useTranslation. */
export function stockTone(stock) {
  if (stock <= 0) return 'out'
  if (stock < LOW_STOCK_THRESHOLD) return 'low'
  return 'in'
}

// Stock label (uses current i18n language)
export function stockLabel(stock) {
  const tone = stockTone(stock)
  if (tone === 'out') return { text: i18n.t('pos.noStock'), tone }
  if (tone === 'low') return { text: i18n.t('pos.lowStock', { stock }), tone }
  return { text: i18n.t('pos.inStock'), tone }
}

export function stockOutMessage(stock) {
  return i18n.t('cart.stockOut', { stock })
}

export function stockLowMessage(stock) {
  return i18n.t('cart.stockLow', { stock })
}

// Find by SKU or barcode
export function findBySkuOrBarcode(products, query) {
  const q = query.trim()
  if (!q) return null
  return (
    products.find(
      (p) => p.barcode === q || p.sku.toLowerCase() === q.toLowerCase(),
    ) || null
  )
}

// Stable fingerprint for exchange “unchanged cart” check (Phase 3 wires error fully)
export function cartFingerprint(items) {
  return (items || [])
    .filter((i) => !i.returned && i.qty > 0)
    .map((i) => `${i.productId}:${i.qty}:${i.unitPrice}`)
    .sort()
    .join('|')
}

// Filter catalog products  
export function filterCatalogProducts(products, { query, categoryId, sub }) {
  const q = (query || '').trim().toLowerCase()
  if (q) {
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.includes(q)),
    )
  }
  if (categoryId === 'all' || categoryId === 'popular') {
    return categoryId === 'popular' ? products.filter((p) => p.popular) : products
  }
  let list = products.filter((p) => p.category === categoryId)
  if (sub) list = list.filter((p) => p.subCategory === sub)
  return list
}
