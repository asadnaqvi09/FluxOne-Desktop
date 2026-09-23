import { connectDb } from '../config/database.js';

const PRODUCT_FIELDS = `
  p.id,
  p.sku,
  p.barcode,
  p.name,
  p.category_id AS categoryId,
  p.subcategory_id AS subcategoryId,
  p.price,
  p.discount,
  p.stock,
  p.is_popular AS isPopular,
  p.image_url AS imageUrl
`;

export function listCategories() {
  const db = connectDb();
  return db
    .prepare(
      `
    SELECT id, name, has_subcategories AS hasSubcategories, sort_order AS sortOrder
    FROM categories
    WHERE is_active = 1
    ORDER BY sort_order ASC, name ASC
  `
    )
    .all();
}

export function findCategory(id) {
  const db = connectDb();
  return (
    db
      .prepare(
        `
      SELECT id, name, has_subcategories AS hasSubcategories, sort_order AS sortOrder
      FROM categories
      WHERE id = ? AND is_active = 1
      LIMIT 1
    `
      )
      .get(id) || null
  );
}

export function listSubcategories(categoryId) {
  const db = connectDb();
  return db
    .prepare(
      `
    SELECT id, category_id AS categoryId, name, sort_order AS sortOrder
    FROM subcategories
    WHERE category_id = ? AND is_active = 1
    ORDER BY sort_order ASC, name ASC
  `
    )
    .all(categoryId);
}

export function findBySkuOrBarcode(code) {
  const db = connectDb();
  return (
    db
      .prepare(
        `
      SELECT ${PRODUCT_FIELDS}
      FROM products p
      WHERE p.is_active = 1 AND (p.sku = ? OR p.barcode = ?)
      LIMIT 1
    `
      )
      .get(code, code) || null
  );
}

export function findProductById(id) {
  const db = connectDb();
  return (
    db
      .prepare(
        `
      SELECT ${PRODUCT_FIELDS}
      FROM products p
      WHERE p.id = ? AND p.is_active = 1
      LIMIT 1
    `
      )
      .get(id) || null
  );
}

export function getProductTaxes(productId) {
  const db = connectDb();
  return db
    .prepare(
      `
    SELECT tr.id, tr.name, tr.rate
    FROM product_taxes pt
    JOIN tax_rules tr ON tr.id = pt.tax_rule_id AND tr.is_active = 1
    WHERE pt.product_id = ?
    ORDER BY tr.name ASC
  `
    )
    .all(productId);
}

export function getTaxesForProducts(productIds) {
  if (!productIds.length) return new Map();
  const db = connectDb();
  const placeholders = productIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `
      SELECT pt.product_id AS productId, tr.id, tr.name, tr.rate
      FROM product_taxes pt
      JOIN tax_rules tr ON tr.id = pt.tax_rule_id AND tr.is_active = 1
      WHERE pt.product_id IN (${placeholders})
      ORDER BY tr.name ASC
    `
    )
    .all(...productIds);
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.productId)) map.set(row.productId, []);
    map.get(row.productId).push({ id: row.id, name: row.name, rate: row.rate });
  }
  return map;
}

export function listProducts({ categoryId, subcategoryId, q, popular, page, pageSize }) {
  // Cashier catalog: hide zero-stock items (admin list is separate).
  const where = ['p.is_active = 1', 'p.stock > 0'];
  const params = {};
  if (popular) where.push('p.is_popular = 1');
  if (categoryId) {
    where.push('p.category_id = @categoryId');
    params.categoryId = categoryId;
  }
  if (subcategoryId) {
    where.push('p.subcategory_id = @subcategoryId');
    params.subcategoryId = subcategoryId;
  }
  if (q) {
    where.push("(p.name LIKE @q OR p.sku LIKE @q OR IFNULL(p.barcode, '') LIKE @q)");
    params.q = `%${q}%`;
  }
  const whereSql = where.join(' AND ');
  const db = connectDb();
  const total = db
    .prepare(`SELECT COUNT(*) AS n FROM products p WHERE ${whereSql}`)
    .get(params).n;
  const offset = (page - 1) * pageSize;
  params.limit = pageSize;
  params.offset = offset;
  const items = db
    .prepare(
      `
      SELECT ${PRODUCT_FIELDS}
      FROM products p
      WHERE ${whereSql}
      ORDER BY p.name ASC
      LIMIT @limit OFFSET @offset
    `
    )
    .all(params);
  return { items, total, page, pageSize };
}
