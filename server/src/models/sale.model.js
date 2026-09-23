/**
 * Sale tabs / open carts
 * Persist across lock; wiped when cash drawer closes.
 */
import { connectDb } from '../config/database.js';
import { ERROR_CODE } from '../config/constants.js';

const TAB_FIELDS = `
  id,
  cash_drawer_id AS cashDrawerId,
  employee_id AS employeeId,
  auth_session_id AS authSessionId,
  tab_index AS tabIndex,
  status,
  mode,
  exchange_invoice_id AS exchangeInvoiceId,
  exchanged_credit AS exchangedCredit,
  exchanged_fingerprint AS exchangedFingerprint,
  exchanged_item_ids AS exchangedItemIds
`;

const ITEM_FIELDS = `
  id,
  tab_id AS tabId,
  product_id AS productId,
  sku,
  name,
  qty,
  unit_price AS unitPrice,
  discount
`;

export function runTx(fn) {
  return connectDb().transaction(fn)();
}

export function findOpenCashDrawer(employeeId) {
  const db = connectDb();
  return (
    db
      .prepare(
        `
      SELECT id, employee_id AS employeeId, status
      FROM cash_drawer_sessions
      WHERE employee_id = ? AND status = 'open'
      LIMIT 1
    `
      )
      .get(employeeId) || null
  );
}

export function listOpenTabs(employeeId, cashDrawerId) {
  const db = connectDb();
  return db
    .prepare(
      `
    SELECT ${TAB_FIELDS}, created_at AS createdAt
    FROM sale_tabs
    WHERE employee_id = ? AND cash_drawer_id = ? AND status = 'open'
    ORDER BY tab_index ASC
  `
    )
    .all(employeeId, cashDrawerId);
}

export function findOpenTab(tabId, employeeId) {
  const db = connectDb();
  return (
    db
      .prepare(
        `
      SELECT ${TAB_FIELDS}
      FROM sale_tabs
      WHERE id = ? AND employee_id = ? AND status = 'open'
      LIMIT 1
    `
      )
      .get(tabId, employeeId) || null
  );
}

/** Next label index among currently open tabs only (checked-out/void do not bump Sale N). */
function nextTabIndex(employeeId, cashDrawerId) {
  const db = connectDb();
  return db
    .prepare(
      `
    SELECT COALESCE(MAX(tab_index), 0) + 1 AS nextIndex
    FROM sale_tabs
    WHERE employee_id = ? AND cash_drawer_id = ? AND status = 'open'
  `
    )
    .get(employeeId, cashDrawerId).nextIndex;
}

export function createTab({ id, cashDrawerId, employeeId, authSessionId }) {
  const db = connectDb();
  const tabIndex = nextTabIndex(employeeId, cashDrawerId);
  db.prepare(
    `
    INSERT INTO sale_tabs (
      id, cash_drawer_id, employee_id, auth_session_id, tab_index, status, mode
    ) VALUES (@id, @cashDrawerId, @employeeId, @authSessionId, @tabIndex, 'open', 'sale')
  `
  ).run({ id, cashDrawerId, employeeId, authSessionId, tabIndex });
  return findOpenTab(id, employeeId);
}

export function findOpenExchangeTab(employeeId, cashDrawerId, invoiceId) {
  const db = connectDb();
  return (
    db
      .prepare(
        `
      SELECT ${TAB_FIELDS}
      FROM sale_tabs
      WHERE employee_id = ? AND cash_drawer_id = ? AND status = 'open'
        AND mode = 'exchange' AND exchange_invoice_id = ?
      LIMIT 1
    `
      )
      .get(employeeId, cashDrawerId, invoiceId) || null
  );
}

export function createExchangeTab({
  id,
  cashDrawerId,
  employeeId,
  authSessionId,
  exchangeInvoiceId,
  exchangedCredit,
  exchangedFingerprint,
  exchangedItemIds,
}) {
  const db = connectDb();
  const tabIndex = nextTabIndex(employeeId, cashDrawerId);
  db.prepare(
    `
    INSERT INTO sale_tabs (
      id, cash_drawer_id, employee_id, auth_session_id, tab_index, status, mode,
      exchange_invoice_id, exchanged_credit, exchanged_fingerprint, exchanged_item_ids
    ) VALUES (
      @id, @cashDrawerId, @employeeId, @authSessionId, @tabIndex, 'open', 'exchange',
      @exchangeInvoiceId, @exchangedCredit, @exchangedFingerprint, @exchangedItemIds
    )
  `
  ).run({
    id,
    cashDrawerId,
    employeeId,
    authSessionId,
    tabIndex,
    exchangeInvoiceId,
    exchangedCredit,
    exchangedFingerprint,
    exchangedItemIds,
  });
  return findOpenTab(id, employeeId);
}

export function updateExchangeTab(row) {
  const db = connectDb();
  db.prepare(
    `
    UPDATE sale_tabs SET
      exchanged_credit = @exchangedCredit,
      exchanged_fingerprint = @exchangedFingerprint,
      exchanged_item_ids = @exchangedItemIds,
      updated_at = datetime('now')
    WHERE id = @id AND status = 'open'
  `
  ).run(row);
  return findOpenTab(row.id, row.employeeId);
}

export function clearTabItems(tabId) {
  const db = connectDb();
  db.prepare(`DELETE FROM sale_tab_items WHERE tab_id = ?`).run(tabId);
  db.prepare(`UPDATE sale_tabs SET updated_at = datetime('now') WHERE id = ?`).run(tabId);
}

export function incrementStock(productId, qty) {
  const db = connectDb();
  db.prepare(
    `
    UPDATE products SET stock = stock + ?, updated_at = datetime('now')
    WHERE id = ?
  `
  ).run(qty, productId);
}

export function voidTab(tabId, employeeId) {
  const db = connectDb();
  return (
    db
      .prepare(
        `
      UPDATE sale_tabs SET status = 'void', updated_at = datetime('now')
      WHERE id = ? AND employee_id = ? AND status = 'open'
    `
      )
      .run(tabId, employeeId).changes > 0
  );
}

export function countOpenTabs(employeeId, cashDrawerId) {
  const db = connectDb();
  return db
    .prepare(
      `
    SELECT COUNT(*) AS n FROM sale_tabs
    WHERE employee_id = ? AND cash_drawer_id = ? AND status = 'open'
  `
    )
    .get(employeeId, cashDrawerId).n;
}

export function listItems(tabId) {
  const db = connectDb();
  return db
    .prepare(
      `
    SELECT ${ITEM_FIELDS}, created_at AS createdAt
    FROM sale_tab_items
    WHERE tab_id = ?
    ORDER BY created_at ASC
  `
    )
    .all(tabId);
}

export function findItem(lineId, tabId) {
  const db = connectDb();
  return (
    db
      .prepare(
        `
      SELECT ${ITEM_FIELDS}
      FROM sale_tab_items
      WHERE id = ? AND tab_id = ?
      LIMIT 1
    `
      )
      .get(lineId, tabId) || null
  );
}

export function findItemByProduct(tabId, productId) {
  const db = connectDb();
  return (
    db
      .prepare(
        `
      SELECT ${ITEM_FIELDS}
      FROM sale_tab_items
      WHERE tab_id = ? AND product_id = ?
      LIMIT 1
    `
      )
      .get(tabId, productId) || null
  );
}

export function addItem(row) {
  const db = connectDb();
  db.prepare(
    `
    INSERT INTO sale_tab_items (
      id, tab_id, product_id, sku, name, qty, unit_price, discount
    ) VALUES (@id, @tabId, @productId, @sku, @name, @qty, @unitPrice, @discount)
  `
  ).run(row);
  db.prepare(`UPDATE sale_tabs SET updated_at = datetime('now') WHERE id = ?`).run(row.tabId);
  return findItem(row.id, row.tabId);
}

export function updateItemQty(lineId, tabId, qty) {
  const db = connectDb();
  db.prepare(`UPDATE sale_tab_items SET qty = ? WHERE id = ? AND tab_id = ?`).run(
    qty,
    lineId,
    tabId
  );
  db.prepare(`UPDATE sale_tabs SET updated_at = datetime('now') WHERE id = ?`).run(tabId);
  return findItem(lineId, tabId);
}

export function removeItem(lineId, tabId) {
  const db = connectDb();
  const ok =
    db.prepare(`DELETE FROM sale_tab_items WHERE id = ? AND tab_id = ?`).run(lineId, tabId)
      .changes > 0;
  if (ok) {
    db.prepare(`UPDATE sale_tabs SET updated_at = datetime('now') WHERE id = ?`).run(tabId);
  }
  return ok;
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

export function computeTotals(items) {
  let actual = 0;
  let afterDiscount = 0;
  const taxMap = new Map();
  const taxCache = new Map();
  const lineDetails = [];

  for (const line of items) {
    const qty = Number(line.qty);
    if (qty <= 0) continue;
    const unit = Number(line.unitPrice);
    const disc = Number(line.discount || 0);
    const lineActual = unit * qty;
    const lineNet = Math.max(0, unit - disc) * qty;
    actual += lineActual;
    afterDiscount += lineNet;
    let taxes = taxCache.get(line.productId);
    if (!taxes) {
      taxes = getProductTaxes(line.productId);
      taxCache.set(line.productId, taxes);
    }
    let lineTax = 0;
    for (const tax of taxes) {
      const amount = (lineNet * Number(tax.rate)) / 100;
      lineTax += amount;
      const prev = taxMap.get(tax.id) || {
        id: tax.id,
        name: tax.name,
        rate: tax.rate,
        amount: 0,
      };
      prev.amount += amount;
      taxMap.set(tax.id, prev);
    }
    lineDetails.push({
      ...line,
      qty,
      lineNet: Number(lineNet.toFixed(2)),
      lineTax: Number(lineTax.toFixed(2)),
      lineTotal: Number((lineNet + lineTax).toFixed(2)),
    });
  }

  const taxes = [...taxMap.values()].map((t) => ({
    ...t,
    amount: Number(t.amount.toFixed(2)),
  }));
  const taxTotal = taxes.reduce((s, t) => s + t.amount, 0);
  return {
    actual: Number(actual.toFixed(2)),
    afterDiscount: Number(afterDiscount.toFixed(2)),
    taxes,
    taxTotal: Number(taxTotal.toFixed(2)),
    total: Number((afterDiscount + taxTotal).toFixed(2)),
    discountTotal: Number((actual - afterDiscount).toFixed(2)),
    lineDetails,
  };
}

export function nextInvoiceId() {
  const db = connectDb();
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
  const next = floor + 1;

  db.prepare(
    `
    INSERT INTO id_counters (name, last_value) VALUES ('invoice', @next)
    ON CONFLICT(name) DO UPDATE SET last_value = @next
  `
  ).run({ next });

  return `INV-${next}`;
}

export function assertAndDecrementStock(productId, qty) {
  const db = connectDb();
  const row = db
    .prepare(`SELECT id, name, stock FROM products WHERE id = ? AND is_active = 1`)
    .get(productId);
  const available = row?.stock ?? 0;
  if (!row || available < qty) {
    const label = row?.name || productId;
    const err = new Error(
      `This item is out of stock. Stock: ${available}. Contact/inform admin. (${label})`
    );
    err.statusCode = 409;
    err.code = ERROR_CODE.INSUFFICIENT_STOCK;
    throw err;
  }
  const result = db
    .prepare(
      `
    UPDATE products SET stock = stock - ?, updated_at = datetime('now')
    WHERE id = ? AND stock >= ?
  `
    )
    .run(qty, productId, qty);
  if (result.changes === 0) {
    const err = new Error(
      `This item is out of stock. Stock: ${available}. Contact/inform admin.`
    );
    err.statusCode = 409;
    err.code = ERROR_CODE.INSUFFICIENT_STOCK;
    throw err;
  }
}

export function markTabCheckedOut(tabId) {
  const db = connectDb();
  db.prepare(
    `
    UPDATE sale_tabs SET status = 'checked_out', updated_at = datetime('now')
    WHERE id = ? AND status = 'open'
  `
  ).run(tabId);
}

export function insertSaleInvoice(row) {
  const db = connectDb();
  db.prepare(
    `
    INSERT INTO invoices (
      id, cash_drawer_id, employee_id, type, payment_status,
      item_count, subtotal, discount, tax, total, tendered, change_due, net_due
    ) VALUES (
      @id, @cashDrawerId, @employeeId, @type, @paymentStatus,
      @itemCount, @subtotal, @discount, @tax, @total, @tendered, @changeDue, @netDue
    )
  `
  ).run(row);
}

export function insertSaleInvoiceItem(row) {
  const db = connectDb();
  db.prepare(
    `
    INSERT INTO invoice_items (
      id, invoice_id, product_id, sku, name, qty,
      unit_price, discount, tax, line_total, is_returned
    ) VALUES (
      @id, @invoiceId, @productId, @sku, @name, @qty,
      @unitPrice, @discount, @tax, @lineTotal, 0
    )
  `
  ).run(row);
}

export function insertSaleInvoiceTax(row) {
  const db = connectDb();
  db.prepare(
    `
    INSERT INTO invoice_taxes (id, invoice_id, tax_rule_id, name, rate, amount)
    VALUES (@id, @invoiceId, @taxRuleId, @name, @rate, @amount)
  `
  ).run(row);
}

export function insertSaleCashMovement(row) {
  const db = connectDb();
  db.prepare(
    `
    INSERT INTO cash_movements (id, cash_drawer_id, type, amount, invoice_id)
    VALUES (@id, @cashDrawerId, @type, @amount, @invoiceId)
  `
  ).run(row);
}

export function insertSaleInventory(row) {
  const db = connectDb();
  db.prepare(
    `
    INSERT INTO inventory_movements (id, product_id, qty_delta, reason, invoice_id)
    VALUES (@id, @productId, @qtyDelta, @reason, @invoiceId)
  `
  ).run(row);
}

export function insertSaleActivity(row) {
  const db = connectDb();
  db.prepare(
    `
    INSERT INTO activity_logs (id, employee_id, action, entity_type, entity_id, details)
    VALUES (@id, @employeeId, @action, @entityType, @entityId, @details)
  `
  ).run(row);
}

export function insertSaleNotification(row) {
  const db = connectDb();
  db.prepare(
    `
    INSERT INTO notifications (id, employee_id, source, title, body)
    VALUES (@id, @employeeId, @source, @title, @body)
  `
  ).run(row);
}

export function getStoreProfile() {
  const db = connectDb();
  return (
    db
      .prepare(
        `
      SELECT name, contact_phone AS contactPhone, contact_email AS contactEmail,
             address, warning_message AS warningMessage,
             return_instructions AS returnInstructions, currency
      FROM store_profile WHERE id = 'store'
    `
      )
      .get() || null
  );
}

export function getInvoiceBundle(invoiceId) {
  const db = connectDb();
  const invoice = db
    .prepare(
      `
    SELECT id, cash_drawer_id AS cashDrawerId, employee_id AS employeeId,
           type, payment_status AS paymentStatus, item_count AS itemCount,
           subtotal, discount, tax, total, tendered, change_due AS changeDue,
           net_due AS netDue, created_at AS createdAt
    FROM invoices WHERE id = ?
  `
    )
    .get(invoiceId);
  if (!invoice) return null;
  const items = db
    .prepare(
      `
    SELECT id, product_id AS productId, sku, name, qty,
           unit_price AS unitPrice, discount, tax, line_total AS lineTotal,
           is_returned AS isReturned
    FROM invoice_items WHERE invoice_id = ? ORDER BY rowid ASC
  `
    )
    .all(invoiceId);
  const taxes = db
    .prepare(
      `
    SELECT id, tax_rule_id AS taxRuleId, name, rate, amount
    FROM invoice_taxes WHERE invoice_id = ?
  `
    )
    .all(invoiceId);
  return {
    invoice,
    items,
    taxes,
    store: getStoreProfile(),
  };
}
