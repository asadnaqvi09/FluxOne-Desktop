// Map server product (+ taxes) → shape expected by Pos cart helpers
const CATEGORY_EMOJI = {
  cat_food: '🍔',
  cat_footwear: '👟',
}

export function mapApiProduct(product) {
  if (!product) return null
  const taxes = Array.isArray(product.taxes) ? product.taxes : []
  const tax1Rate = Number(taxes[0]?.rate || 0) / 100
  const tax2Rate = Number(taxes[1]?.rate || 0) / 100
  const discountPct = Number(product.discount || 0)

  return {
    id: product.id,
    sku: product.sku,
    barcode: product.barcode || '',
    name: product.name,
    price: Number(product.price) || 0,
    stock: Number(product.stock) || 0,
    emoji: CATEGORY_EMOJI[product.categoryId] || '🛒',
    categoryId: product.categoryId,
    subcategoryId: product.subcategoryId || '',
    discountPct,
    tax1Rate,
    tax2Rate,
    taxes,
    popular: Boolean(product.isPopular),
    imageUrl: product.imageUrl || null,
  }
}

// Map API products list to UI shape
export function mapApiProducts(items = []) {
  return items.map(mapApiProduct).filter(Boolean)
}
