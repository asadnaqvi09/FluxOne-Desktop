/**
 * Admin item rates + activity helpers
 */
import { connectDb } from '../config/database.js';

const PRODUCT_DETAIL_FIELDS = `
  p.id, p.sku, p.barcode, p.name, p.image_url AS imageUrl,
  p.category_id AS categoryId, p.subcategory_id AS subcategoryId,
  p.price, p.discount, p.stock, p.is_popular AS isPopular,
  p.is_active AS isActive, p.updated_at AS updatedAt,
  c.name AS categoryName, s.name AS subcategoryName
`;

export function runTx(fn) {
  return connectDb().transaction(fn)();
}

export function findProduct(id) {
  const db = connectDb();
  const row = db
    .prepare(
      `
    SELECT ${PRODUCT_DETAIL_FIELDS}
    FROM products p
    JOIN categories c ON c.id = p.category_id
    LEFT JOIN subcategories s ON s.id = p.subcategory_id
    WHERE p.id = ?
    LIMIT 1
  `
    )
    .get(id);
  if (!row) return null;
  return {
    ...row,
    isPopular: Boolean(row.isPopular),
    isActive: Boolean(row.isActive),
  };
}

export function getProductTaxes(productId) {
  const db = connectDb();
  return db
    .prepare(
      `
    SELECT tr.id, tr.name, tr.rate
    FROM product_taxes pt
    JOIN tax_rules tr ON tr.id = pt.tax_rule_id
    WHERE pt.product_id = ?
    ORDER BY tr.name ASC
  `
    )
    .all(productId);
}

export function listTaxRules() {
  const db = connectDb();
  return db
    .prepare(
      `
    SELECT id, name, rate FROM tax_rules
    WHERE is_active = 1
    ORDER BY name ASC
  `
    )
    .all();
}

export function findTaxRule(id) {
  const db = connectDb();
  return (
    db
      .prepare(
        `
      SELECT id, name, rate FROM tax_rules
      WHERE id = ? AND is_active = 1
    `
      )
      .get(id) || null
  );
}

/** Find an active tax rule with this percentage rate (e.g. 17 = 17%). */
export function findTaxRuleByRate(rate) {
  const pct = Math.round(Number(rate) * 100) / 100;
  if (!pct) return null;
  const db = connectDb();
  return (
    db
      .prepare(
        `
      SELECT id, name, rate FROM tax_rules
      WHERE is_active = 1 AND ABS(rate - ?) < 0.001
      LIMIT 1
    `
      )
      .get(pct) || null
  );
}

/** Reuse an existing rule for this rate, or create one (admin typed %). */
export function ensureTaxRuleForRate(rate) {
  const pct = Math.round(Number(rate) * 100) / 100;
  if (pct <= 0 || pct > 100) return null;
  const existing = findTaxRuleByRate(pct);
  if (existing) return existing;
  const db = connectDb();
  const id = `tax_${String(pct).replace('.', '_')}`;
  const name = `Tax ${pct}%`;
  db.prepare(
    `
    INSERT INTO tax_rules (id, name, rate)
    VALUES (?, ?, ?)
  `
  ).run(id, name, pct);
  return findTaxRule(id);
}

/** Map admin-entered percentages (0–100) to tax rule ids. */
export function resolveTaxRuleIdsFromRates(rates = []) {
  const ids = [];
  for (const raw of rates) {
    const pct = Number(raw);
    if (!pct) continue;
    const rule = ensureTaxRuleForRate(pct);
    if (rule?.id) ids.push(rule.id);
  }
  return ids;
}

export function updateProduct({ id, price, discount }) {
  const db = connectDb();
  db.prepare(
    `
    UPDATE products SET
      price = COALESCE(@price, price),
      discount = COALESCE(@discount, discount),
      updated_at = datetime('now')
    WHERE id = @id
  `
  ).run({
    id,
    price: price ?? null,
    discount: discount ?? null,
  });
  return findProduct(id);
}

export function replaceProductTaxes(productId, taxRuleIds) {
  const db = connectDb();
  db.prepare(`DELETE FROM product_taxes WHERE product_id = ?`).run(productId);
  const insert = db.prepare(
    `INSERT INTO product_taxes (product_id, tax_rule_id) VALUES (?, ?)`
  );
  for (const taxRuleId of taxRuleIds) {
    insert.run(productId, taxRuleId);
  }
}

export function insertActivity(row) {
  const db = connectDb();
  db.prepare(
    `
    INSERT INTO activity_logs (id, employee_id, action, entity_type, entity_id, details)
    VALUES (@id, @employeeId, @action, @entityType, @entityId, @details)
  `
  ).run(row);
}

export function listProducts({ categoryId, subcategoryId, q, page, pageSize }) {
  const where = ['1 = 1'];
  const params = {};
  if (categoryId) {
    where.push('p.category_id = @categoryId');
    params.categoryId = categoryId;
  }
  if (subcategoryId) {
    where.push('p.subcategory_id = @subcategoryId');
    params.subcategoryId = subcategoryId;
  }
  if (q) {
    where.push(
      "(p.id LIKE @q OR p.sku LIKE @q OR p.name LIKE @q OR IFNULL(p.barcode, '') LIKE @q)"
    );
    params.q = `%${q}%`;
  }
  const whereSql = where.join(' AND ');
  const db = connectDb();
  const total = db
    .prepare(`SELECT COUNT(*) AS n FROM products p WHERE ${whereSql}`)
    .get(params).n;
  params.limit = pageSize;
  params.offset = (page - 1) * pageSize;
  const items = db
    .prepare(
      `
      SELECT p.id, p.sku, p.barcode, p.name, p.image_url AS imageUrl,
             p.price, p.discount, p.stock,
             p.category_id AS categoryId, p.subcategory_id AS subcategoryId,
             c.name AS categoryName, s.name AS subcategoryName
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN subcategories s ON s.id = p.subcategory_id
      WHERE ${whereSql}
      ORDER BY c.sort_order ASC, p.name ASC
      LIMIT @limit OFFSET @offset
    `
    )
    .all(params);
  return { items, total, page, pageSize };
}
