import { randomUUID } from 'node:crypto';
import { connectDb } from '../../config/database.js';
import * as syncMetaModel from '../../models/syncMeta.model.js';
import {
  buildInventoryMap,
  mapCloudCategoryRow,
  mapCloudCounterRow,
  mapCloudProductRow,
  mapCloudSubcategoryRow,
  mapCloudTaxRow,
  mapCloudUserToEmployee,
  mapCompanyToStoreProfile,
  mapProductTaxLinks,
  normalizeSnapshot,
  splitCloudCategories,
} from './mappers.js';

export function runApplyTransaction(fn) {
  return connectDb().transaction(fn)();
}

function renameLegacyUniqueConflict(db, { table, uniqueColumn, uniqueValue, newId }) {
  if (!uniqueValue || !newId) return;
  const existing = db
    .prepare(`SELECT id FROM ${table} WHERE ${uniqueColumn} = ? LIMIT 1`)
    .get(uniqueValue);
  if (!existing || existing.id === newId) return;

  db.prepare(
    `
    UPDATE ${table}
    SET ${uniqueColumn} = @legacyValue
    WHERE id = @id
  `
  ).run({
    id: existing.id,
    legacyValue: `${uniqueValue}__legacy_${existing.id}`,
  });
}

function retireLegacyEmployeeLogin(db, userId, newId) {
  const existing = db
    .prepare(`SELECT id FROM employees WHERE user_id = ? LIMIT 1`)
    .get(userId);
  if (!existing || existing.id === newId) return;
  db.prepare(
    `
    UPDATE employees
    SET user_id = @legacyUserId, is_active = 0, updated_at = datetime('now')
    WHERE id = @id
  `
  ).run({
    id: existing.id,
    legacyUserId: `${userId}__legacy_${existing.id}`,
  });
}

function purgeLegacySeedData(db) {
  db.prepare(
    `
    UPDATE employees
    SET is_active = 0, updated_at = datetime('now')
    WHERE role = 'supervisor'
       OR id LIKE 'ADM-%'
       OR id LIKE 'CSH-%'
       OR id LIKE 'SUP-%'
       OR user_id IN ('admin01', 'cashier01', 'supervisor01')
  `
  ).run();

  db.prepare(`DELETE FROM product_taxes WHERE product_id LIKE 'prd_%'`).run();

  db.prepare(
    `
    UPDATE products
    SET is_active = 0, updated_at = datetime('now')
    WHERE id LIKE 'prd_%'
  `
  ).run();

  db.prepare(`UPDATE categories SET is_active = 0 WHERE id LIKE 'cat_%'`).run();
  db.prepare(`UPDATE subcategories SET is_active = 0 WHERE id LIKE 'sub_%'`).run();
  db.prepare(`UPDATE tax_rules SET is_active = 0 WHERE id LIKE 'tax_%'`).run();
}

export function applyCatalogSnapshot(data = {}, { isBootstrap = false, deferBootstrapDone = false } = {}) {
  const snapshot = normalizeSnapshot(data);
  const counts = {
    users: 0,
    categories: 0,
    subcategories: 0,
    products: 0,
    taxes: 0,
    productTaxes: 0,
    counters: 0,
  };

  runApplyTransaction(() => {
    const db = connectDb();
    if (isBootstrap) {
      purgeLegacySeedData(db);
    }
    counts.users = applyUsers(db, snapshot.users);
    const categoryCounts = applyCategories(db, snapshot.categories);
    counts.categories = categoryCounts.categories;
    counts.subcategories = categoryCounts.subcategories;
    counts.taxes = applyTaxes(db, snapshot.taxes);

    const inventoryMap = buildInventoryMap(snapshot.branchInventory);
    const productResult = applyProducts(db, snapshot.products, {
      inventoryMap,
      categories: snapshot.categories,
    });
    counts.products = productResult.count;
    counts.productTaxes = applyProductTaxes(
      db,
      mapProductTaxLinks(snapshot.productTaxes, snapshot.products),
      productResult.insertedIds
    );
    counts.counters = applyCounters(db, snapshot.counters);
    applyStoreProfile(db, snapshot.company, snapshot.branch);

    const tenantId = snapshot.tenant?.id ?? snapshot.tenant?.tenantId ?? null;
    const branchId = snapshot.branch?.id ?? snapshot.branch?.branchId ?? null;
    const pullAt = new Date().toISOString();

    const shouldMarkBootstrapDone = isBootstrap && !deferBootstrapDone;
    syncMetaModel.updateSyncMeta({
      tenantId: tenantId ?? undefined,
      branchId: branchId ?? undefined,
      lastPullAt: pullAt,
      bootstrapDone: shouldMarkBootstrapDone ? true : undefined,
    });

    db.prepare(
      `
      INSERT INTO sync_state (id, last_synced_at, source)
      VALUES (1, datetime('now'), 'cloud')
      ON CONFLICT(id) DO UPDATE SET
        last_synced_at = excluded.last_synced_at,
        source = excluded.source
    `
    ).run();
  });

  return counts;
}

function applyUsers(db, users = []) {
  const stmt = db.prepare(
    `
    INSERT INTO employees (
      id, user_id, name, role, email, password_hash, picture_url, is_active
    ) VALUES (
      @id, @userId, @name, @role, @email, @passwordHash, @pictureUrl, @isActive
    )
    ON CONFLICT(id) DO UPDATE SET
      user_id = excluded.user_id,
      name = excluded.name,
      role = excluded.role,
      email = excluded.email,
      password_hash = COALESCE(excluded.password_hash, employees.password_hash),
      picture_url = excluded.picture_url,
      is_active = excluded.is_active,
      updated_at = datetime('now')
  `
  );

  let count = 0;
  for (const user of users) {
    const row = mapCloudUserToEmployee(user);
    if (!row) continue;
    retireLegacyEmployeeLogin(db, row.userId, row.id);
    stmt.run({
      ...row,
      passwordHash: row.passwordHash || '',
      pictureUrl: row.pictureUrl ?? null,
    });
    count += 1;
  }
  return count;
}

function applyCategories(db, categories = []) {
  const { roots, children, childParentMap, childCountByRoot } = splitCloudCategories(categories);

  const upsertCategory = db.prepare(
    `
    INSERT INTO categories (id, name, has_subcategories, sort_order, is_active)
    VALUES (@id, @name, @hasSubcategories, @sortOrder, @isActive)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      has_subcategories = excluded.has_subcategories,
      sort_order = excluded.sort_order,
      is_active = excluded.is_active
  `
  );

  const upsertSubcategory = db.prepare(
    `
    INSERT INTO subcategories (id, category_id, name, sort_order, is_active)
    VALUES (@id, @categoryId, @name, @sortOrder, @isActive)
    ON CONFLICT(id) DO UPDATE SET
      category_id = excluded.category_id,
      name = excluded.name,
      sort_order = excluded.sort_order,
      is_active = excluded.is_active
  `
  );

  let categoryCount = 0;
  for (const category of roots) {
    const row = mapCloudCategoryRow(category, childCountByRoot);
    if (!row) continue;
    renameLegacyUniqueConflict(db, {
      table: 'categories',
      uniqueColumn: 'name',
      uniqueValue: row.name,
      newId: row.id,
    });
    upsertCategory.run(row);
    categoryCount += 1;
  }

  let subcategoryCount = 0;
  const rootIdSet = new Set(roots.map((category) => category.id).filter(Boolean));
  for (const subcategory of children) {
    const row = mapCloudSubcategoryRow(subcategory, childParentMap);
    if (!row || !rootIdSet.has(row.categoryId)) continue;
    upsertSubcategory.run(row);
    subcategoryCount += 1;
  }

  return { categories: categoryCount, subcategories: subcategoryCount };
}

function applyTaxes(db, taxes = []) {
  const stmt = db.prepare(
    `
    INSERT INTO tax_rules (id, name, rate, is_active)
    VALUES (@id, @name, @rate, @isActive)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      rate = excluded.rate,
      is_active = excluded.is_active
  `
  );

  let count = 0;
  for (const tax of taxes) {
    const row = mapCloudTaxRow(tax);
    if (!row) continue;
    renameLegacyUniqueConflict(db, {
      table: 'tax_rules',
      uniqueColumn: 'name',
      uniqueValue: row.name,
      newId: row.id,
    });
    stmt.run(row);
    count += 1;
  }
  return count;
}

function applyProducts(db, products = [], { inventoryMap, categories }) {
  const split = splitCloudCategories(categories);
  const { childParentMap, roots, children } = split;
  const rootIds = new Set(roots.map((category) => category.id).filter(Boolean));
  const subcategoryIds = new Set(children.map((category) => category.id).filter(Boolean));
  const stmt = db.prepare(
    `
    INSERT INTO products (
      id, sku, barcode, name, category_id, subcategory_id,
      price, discount, stock, is_popular, image_url, is_active
    ) VALUES (
      @id, @sku, @barcode, @name, @categoryId, @subcategoryId,
      @price, @discount, @stock, @isPopular, @imageUrl, @isActive
    )
    ON CONFLICT(id) DO UPDATE SET
      sku = excluded.sku,
      barcode = excluded.barcode,
      name = excluded.name,
      category_id = excluded.category_id,
      subcategory_id = excluded.subcategory_id,
      price = excluded.price,
      discount = excluded.discount,
      stock = excluded.stock,
      is_popular = excluded.is_popular,
      image_url = excluded.image_url,
      is_active = excluded.is_active,
      updated_at = datetime('now')
  `
  );

  let count = 0;
  const insertedIds = new Set();
  for (const product of products) {
    const row = mapCloudProductRow(product, { childParentMap, inventoryMap });
    if (!row) continue;
    if (row.subcategoryId && !subcategoryIds.has(row.subcategoryId)) {
      row.subcategoryId = null;
    }
    if (!rootIds.has(row.categoryId)) continue;
    renameLegacyUniqueConflict(db, {
      table: 'products',
      uniqueColumn: 'sku',
      uniqueValue: row.sku,
      newId: row.id,
    });
    stmt.run({
      id: row.id,
      sku: row.sku,
      barcode: row.barcode,
      name: row.name,
      categoryId: row.categoryId,
      subcategoryId: row.subcategoryId,
      price: row.price,
      discount: row.discount,
      stock: row.stock,
      isPopular: row.isPopular,
      imageUrl: row.imageUrl,
      isActive: row.isActive,
    });
    insertedIds.add(row.id);
    count += 1;
  }
  return { count, insertedIds };
}

function applyProductTaxes(db, links = [], insertedProductIds = null) {
  const deleteForProduct = db.prepare(`DELETE FROM product_taxes WHERE product_id = ?`);
  const insert = db.prepare(
    `INSERT INTO product_taxes (product_id, tax_rule_id) VALUES (?, ?)`
  );
  const productExistsStmt = db.prepare(`SELECT 1 AS ok FROM products WHERE id = ? LIMIT 1`);
  const taxExistsStmt = db.prepare(`SELECT 1 AS ok FROM tax_rules WHERE id = ? LIMIT 1`);
  const touched = new Set();
  let count = 0;

  for (const link of links) {
    if (!link.productId || !link.taxRuleId) continue;
    // Cloud may send productTaxes for products skipped locally (e.g. missing categoryId).
    if (insertedProductIds && !insertedProductIds.has(link.productId)) continue;
    if (!productExistsStmt.get(link.productId)?.ok) continue;
    if (!taxExistsStmt.get(link.taxRuleId)?.ok) continue;
    if (!touched.has(link.productId)) {
      deleteForProduct.run(link.productId);
      touched.add(link.productId);
    }
    insert.run(link.productId, link.taxRuleId);
    count += 1;
  }

  return count;
}

function applyCounters(db, counters = []) {
  const stmt = db.prepare(
    `
    INSERT INTO pos_counters (id, code, name, is_active)
    VALUES (@id, @code, @name, @isActive)
    ON CONFLICT(id) DO UPDATE SET
      code = excluded.code,
      name = excluded.name,
      is_active = excluded.is_active
  `
  );

  let count = 0;
  for (const counter of counters) {
    const row = mapCloudCounterRow(counter);
    if (!row) continue;
    stmt.run(row);
    count += 1;
  }
  return count;
}

function applyStoreProfile(db, company, branch = null) {
  const profile = mapCompanyToStoreProfile(company, branch);
  if (!profile) return;

  // applyFooterText: company was in the snapshot — allow '' to clear printable
  // policies after Admin disables them (COALESCE(null, old) used to stick).
  const applyFooter = profile.applyFooterText ? 1 : 0;

  // Cloud-only boot has no seed row — upsert so Invoice Details / slip work.
  db.prepare(
    `
    INSERT INTO store_profile (
      id, name, contact_phone, contact_email, address,
      warning_message, return_instructions,
      shop_open_time, shop_close_time, currency, updated_at
    ) VALUES (
      'store',
      COALESCE(@name, ''),
      @contactPhone,
      @contactEmail,
      @address,
      @warningMessage,
      @returnInstructions,
      COALESCE(@shopOpenTime, '09:00'),
      COALESCE(@shopCloseTime, '18:00'),
      COALESCE(@currency, 'PKR'),
      datetime('now')
    )
    ON CONFLICT(id) DO UPDATE SET
      name = COALESCE(NULLIF(excluded.name, ''), store_profile.name),
      contact_phone = COALESCE(excluded.contact_phone, store_profile.contact_phone),
      contact_email = COALESCE(excluded.contact_email, store_profile.contact_email),
      address = COALESCE(excluded.address, store_profile.address),
      warning_message = CASE
        WHEN @applyFooter = 1 THEN excluded.warning_message
        ELSE store_profile.warning_message
      END,
      return_instructions = CASE
        WHEN @applyFooter = 1 THEN excluded.return_instructions
        ELSE store_profile.return_instructions
      END,
      shop_open_time = COALESCE(excluded.shop_open_time, store_profile.shop_open_time),
      shop_close_time = COALESCE(excluded.shop_close_time, store_profile.shop_close_time),
      currency = COALESCE(excluded.currency, store_profile.currency),
      updated_at = datetime('now')
  `
  ).run({
    name: profile.name,
    contactPhone: profile.contactPhone,
    contactEmail: profile.contactEmail,
    address: profile.address,
    warningMessage: profile.warningMessage ?? null,
    returnInstructions: profile.returnInstructions ?? null,
    shopOpenTime: profile.shopOpenTime,
    shopCloseTime: profile.shopCloseTime,
    currency: profile.currency,
    applyFooter,
  });
}

const INVOICE_TYPES = new Set(['Sale', 'Return', 'Exchange']);
const PAYMENT_STATUSES = new Set(['Paid', 'Return', 'Adjust']);

function normalizeInvoiceType(value) {
  if (!value) return 'Sale';
  const raw = String(value).trim();
  if (INVOICE_TYPES.has(raw)) return raw;
  const lower = raw.toLowerCase();
  if (lower === 'sale') return 'Sale';
  if (lower === 'return') return 'Return';
  if (lower === 'exchange') return 'Exchange';
  return 'Sale';
}

function normalizePaymentStatus(value, type) {
  if (value) {
    const raw = String(value).trim();
    if (PAYMENT_STATUSES.has(raw)) return raw;
    const lower = raw.toLowerCase();
    if (lower === 'paid') return 'Paid';
    if (lower === 'return') return 'Return';
    if (lower === 'adjust') return 'Adjust';
  }
  if (type === 'Return') return 'Return';
  if (type === 'Exchange') return 'Adjust';
  return 'Paid';
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function readOutboxInvoiceKey(payloadText) {
  try {
    const payload = typeof payloadText === 'string' ? JSON.parse(payloadText) : payloadText;
    return (
      payload?.invoiceId ??
      payload?.saleNumber ??
      payload?.sale_number ??
      payload?.cloudSaleId ??
      payload?.cloud_sale_id ??
      null
    );
  } catch {
    return null;
  }
}

function collectPendingOutboxInvoiceKeys(db) {
  const rows = db
    .prepare(
      `
      SELECT payload
      FROM sync_outbox
      WHERE sync_status IN ('pending', 'failed')
    `
    )
    .all();

  const keys = new Set();
  for (const row of rows) {
    const key = readOutboxInvoiceKey(row.payload);
    if (key) keys.add(String(key));
  }
  return keys;
}

function findLocalInvoice(db, saleNumber, saleId) {
  if (saleNumber) {
    const byId = db
      .prepare(
        `
        SELECT id, cloud_sale_id AS cloudSaleId, cloud_synced_at AS cloudSyncedAt
        FROM invoices
        WHERE id = ?
        LIMIT 1
      `
      )
      .get(saleNumber);
    if (byId) return byId;
  }
  if (saleId) {
    return (
      db
        .prepare(
          `
          SELECT id, cloud_sale_id AS cloudSaleId, cloud_synced_at AS cloudSyncedAt
          FROM invoices
          WHERE cloud_sale_id = ?
          LIMIT 1
        `
        )
        .get(saleId) || null
    );
  }
  return null;
}

function resolveEmployeeId(db, cashierUserId) {
  if (!cashierUserId) return null;
  const row = db
    .prepare(`SELECT id FROM employees WHERE id = ? LIMIT 1`)
    .get(cashierUserId);
  return row?.id ?? null;
}

function resolveProductId(db, productId) {
  if (!productId) return null;
  const row = db.prepare(`SELECT id FROM products WHERE id = ? LIMIT 1`).get(productId);
  return row?.id ?? null;
}

function resolveOriginalInvoiceId(db, originalSaleNumber) {
  if (!originalSaleNumber) return null;
  const row = db
    .prepare(`SELECT id FROM invoices WHERE id = ? LIMIT 1`)
    .get(originalSaleNumber);
  return row?.id ?? null;
}

function upsertInvoiceFromCloud(db, sale) {
  const saleNumber = sale.saleNumber ?? sale.invoiceId ?? sale.sale_number ?? null;
  const saleId = sale.saleId ?? sale.sale_id ?? null;
  if (!saleNumber) return false;

  const type = normalizeInvoiceType(sale.type);
  const paymentStatus = normalizePaymentStatus(sale.paymentStatus ?? sale.payment_status, type);
  const items = Array.isArray(sale.items) ? sale.items : [];
  const remainingLines = items.filter((item) => !(item.isReturned || item.is_returned));
  const itemCount = remainingLines.length;

  const subtotal = num(sale.subtotal);
  const discount = num(sale.discount);
  const tax = num(sale.tax);
  const total = num(sale.total);
  const tendered = num(sale.paidAmount ?? sale.paid_amount ?? sale.tendered, total);
  const netDue = num(sale.netDue ?? sale.net_due, total);
  const changeDue = num(sale.changeDue ?? sale.change_due, 0);
  const createdAt = sale.soldAt ?? sale.sold_at ?? sale.createdAt ?? new Date().toISOString();
  const employeeId = resolveEmployeeId(db, sale.cashierUserId ?? sale.cashier_user_id ?? null);
  const originalInvoiceId = resolveOriginalInvoiceId(
    db,
    sale.originalSaleNumber ?? sale.original_sale_number ?? null
  );

  db.prepare(
    `
    INSERT INTO invoices (
      id, employee_id, type, payment_status,
      item_count, subtotal, discount, tax, total,
      tendered, change_due, net_due, original_invoice_id,
      created_at, cloud_synced_at, cloud_sale_id, payment_method
    ) VALUES (
      @id, @employeeId, @type, @paymentStatus,
      @itemCount, @subtotal, @discount, @tax, @total,
      @tendered, @changeDue, @netDue, @originalInvoiceId,
      @createdAt, datetime('now'), @cloudSaleId, 'cash'
    )
    ON CONFLICT(id) DO UPDATE SET
      employee_id = excluded.employee_id,
      type = excluded.type,
      payment_status = excluded.payment_status,
      item_count = excluded.item_count,
      subtotal = excluded.subtotal,
      discount = excluded.discount,
      tax = excluded.tax,
      total = excluded.total,
      tendered = excluded.tendered,
      change_due = excluded.change_due,
      net_due = excluded.net_due,
      original_invoice_id = COALESCE(excluded.original_invoice_id, invoices.original_invoice_id),
      created_at = excluded.created_at,
      cloud_synced_at = datetime('now'),
      cloud_sale_id = COALESCE(excluded.cloud_sale_id, invoices.cloud_sale_id)
  `
  ).run({
    id: saleNumber,
    employeeId,
    type,
    paymentStatus,
    itemCount,
    subtotal,
    discount,
    tax,
    total,
    tendered,
    changeDue,
    netDue,
    originalInvoiceId,
    createdAt,
    cloudSaleId: saleId,
  });

  db.prepare(`DELETE FROM invoice_items WHERE invoice_id = ?`).run(saleNumber);
  db.prepare(`DELETE FROM invoice_taxes WHERE invoice_id = ?`).run(saleNumber);

  const insertItem = db.prepare(
    `
    INSERT INTO invoice_items (
      id, invoice_id, product_id, sku, name, qty,
      unit_price, discount, tax, line_total, is_returned
    ) VALUES (
      @id, @invoiceId, @productId, @sku, @name, @qty,
      @unitPrice, @discount, @tax, @lineTotal, @isReturned
    )
  `
  );

  for (const line of items) {
    const qty = num(line.quantity ?? line.qty, 0);
    const unitPrice = num(line.unitPrice ?? line.unit_price);
    const lineDiscount = num(line.discount);
    const lineTax = num(line.tax);
    const lineTotal = num(line.lineTotal ?? line.line_total, qty * unitPrice - lineDiscount + lineTax);
    const isReturned = line.isReturned || line.is_returned ? 1 : 0;
    const productId = resolveProductId(db, line.productId ?? line.product_id ?? null);
    const sku = String(line.sku ?? '');
    const name = String(line.name ?? sku ?? 'Item');
    if (!sku && !name) continue;

    insertItem.run({
      id: line.invoiceItemId ?? line.id ?? randomUUID(),
      invoiceId: saleNumber,
      productId,
      sku: sku || name,
      name,
      qty,
      unitPrice,
      discount: lineDiscount,
      tax: lineTax,
      lineTotal,
      isReturned,
    });
  }

  return true;
}

/**
 * Restore cloud sales history into local invoices.
 * Does NOT adjust stock. Skips invoices with pending/failed outbox rows (POS wins).
 */
export function applyCloudSales(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  const stats = { applied: 0, skippedPending: 0, skippedInvalid: 0 };

  if (!list.length) return stats;

  runApplyTransaction(() => {
    const db = connectDb();
    const pendingKeys = collectPendingOutboxInvoiceKeys(db);

    for (const sale of list) {
      const saleNumber = sale?.saleNumber ?? sale?.invoiceId ?? sale?.sale_number ?? null;
      const saleId = sale?.saleId ?? sale?.sale_id ?? null;
      if (!saleNumber) {
        stats.skippedInvalid += 1;
        continue;
      }

      const local = findLocalInvoice(db, saleNumber, saleId);
      const pendingHit =
        pendingKeys.has(String(saleNumber)) ||
        (saleId && pendingKeys.has(String(saleId))) ||
        (local?.id && pendingKeys.has(String(local.id))) ||
        (local?.cloudSaleId && pendingKeys.has(String(local.cloudSaleId)));

      if (local && pendingHit) {
        stats.skippedPending += 1;
        continue;
      }

      if (upsertInvoiceFromCloud(db, sale)) {
        stats.applied += 1;
      } else {
        stats.skippedInvalid += 1;
      }
    }

    bumpInvoiceIdCounter(db);
  });

  return stats;
}

/** Keep local INV-* sequence above any restored cloud sale numbers. */
function bumpInvoiceIdCounter(db) {
  const maxFromInvoices =
    db
      .prepare(
        `
      SELECT COALESCE(MAX(CAST(substr(id, 5) AS INTEGER)), 999) AS maxN
      FROM invoices
      WHERE id GLOB 'INV-[0-9]*'
    `
      )
      .get()?.maxN ?? 999;

  const counterRow = db
    .prepare(`SELECT last_value AS lastValue FROM id_counters WHERE name = 'invoice'`)
    .get();
  const floor = Math.max(Number(counterRow?.lastValue) || 999, Number(maxFromInvoices) || 999);

  db.prepare(
    `
    INSERT INTO id_counters (name, last_value) VALUES ('invoice', @floor)
    ON CONFLICT(name) DO UPDATE SET
      last_value = CASE
        WHEN @floor > id_counters.last_value THEN @floor
        ELSE id_counters.last_value
      END
  `
  ).run({ floor });
}

export function markBootstrapDone() {
  return syncMetaModel.updateSyncMeta({ bootstrapDone: true });
}
