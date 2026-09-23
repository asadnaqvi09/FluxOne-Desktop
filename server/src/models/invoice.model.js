/**
 * Invoices  list, detail, print payload, header updates, history
 */
import { connectDb } from '../config/database.js';
import {
  invoiceShopWindow,
  shopLocalCreatedAt,
} from '../shared/utils/shopTime.util.js';

const INVOICE_FIELDS = `
  i.id,
  i.cash_drawer_id AS cashDrawerId,
  i.employee_id AS employeeId,
  i.type,
  i.payment_status AS paymentStatus,
  i.item_count AS itemCount,
  i.subtotal,
  i.discount,
  i.tax,
  i.total,
  i.tendered,
  i.change_due AS changeDue,
  i.net_due AS netDue,
  i.original_invoice_id AS originalInvoiceId,
  i.created_at AS createdAt
`;

export function runTx(fn) {
  return connectDb().transaction(fn)();
}

export function findById(id) {
  const db = connectDb();
  return (
    db
      .prepare(
        `
      SELECT ${INVOICE_FIELDS},
             e.name AS employeeName
      FROM invoices i
      LEFT JOIN employees e ON e.id = i.employee_id
      WHERE i.id = ?
    `
      )
      .get(id) || null
  );
}

export function listItems(invoiceId) {
  const db = connectDb();
  return db
    .prepare(
      `
    SELECT id, invoice_id AS invoiceId, product_id AS productId, sku, name, qty,
           unit_price AS unitPrice, discount, tax, line_total AS lineTotal,
           is_returned AS isReturned, original_item_id AS originalItemId
    FROM invoice_items
    WHERE invoice_id = ?
    ORDER BY rowid ASC
  `
    )
    .all(invoiceId)
    .map((row) => ({
      ...row,
      isReturned: Boolean(row.isReturned),
    }));
}

export function listTaxes(invoiceId) {
  const db = connectDb();
  return db
    .prepare(
      `
    SELECT id, tax_rule_id AS taxRuleId, name, rate, amount
    FROM invoice_taxes
    WHERE invoice_id = ?
  `
    )
    .all(invoiceId);
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
      FROM store_profile
      WHERE id = 'store'
    `
      )
      .get() || null
  );
}

export function listHistory(invoiceId) {
  const db = connectDb();
  return db
    .prepare(
      `
    SELECT id, invoice_id AS invoiceId, actor_id AS actorId, text,
           created_at AS createdAt
    FROM invoice_history
    WHERE invoice_id = ?
    ORDER BY created_at ASC
  `
    )
    .all(invoiceId);
}

export function insertHistory(row) {
  const db = connectDb();
  db.prepare(
    `
    INSERT INTO invoice_history (id, invoice_id, actor_id, text)
    VALUES (@id, @invoiceId, @actorId, @text)
  `
  ).run(row);
}

export function updateHeader(row) {
  const db = connectDb();
  db.prepare(
    `
    UPDATE invoices SET
      type = @type,
      payment_status = @paymentStatus,
      item_count = @itemCount,
      subtotal = @subtotal,
      discount = @discount,
      tax = @tax,
      total = @total,
      tendered = @tendered,
      change_due = @changeDue,
      net_due = @netDue
    WHERE id = @id
  `
  ).run(row);
}

export function markItemReturned(itemId, invoiceId) {
  const db = connectDb();
  return (
    db
      .prepare(
        `
      UPDATE invoice_items SET is_returned = 1
      WHERE id = ? AND invoice_id = ? AND is_returned = 0
    `
      )
      .run(itemId, invoiceId).changes > 0
  );
}

export function deleteItem(itemId, invoiceId) {
  const db = connectDb();
  return (
    db
      .prepare(`DELETE FROM invoice_items WHERE id = ? AND invoice_id = ?`)
      .run(itemId, invoiceId).changes > 0
  );
}

export function deleteTaxes(invoiceId) {
  const db = connectDb();
  db.prepare(`DELETE FROM invoice_taxes WHERE invoice_id = ?`).run(invoiceId);
}

export function insertItem(row) {
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

export function insertTax(row) {
  const db = connectDb();
  db.prepare(
    `
    INSERT INTO invoice_taxes (id, invoice_id, tax_rule_id, name, rate, amount)
    VALUES (@id, @invoiceId, @taxRuleId, @name, @rate, @amount)
  `
  ).run(row);
}

export function getBundle(invoiceId) {
  const invoice = findById(invoiceId);
  if (!invoice) return null;
  return {
    invoice,
    items: listItems(invoiceId),
    taxes: listTaxes(invoiceId),
    store: getStoreProfile(),
    history: listHistory(invoiceId),
  };
}

export function listInvoices({ date, timeFrom, timeTo, q } = {}) {
  const clauses = [];
  const params = {};
  const localAt = shopLocalCreatedAt('i');
  const window = invoiceShopWindow({ date, timeFrom, timeTo });

  if (window?.kind === 'datetime') {
    clauses.push(`${localAt} >= @from AND ${localAt} <= @to`);
    params.from = window.from;
    params.to = window.to;
  } else if (window?.kind === 'time') {
    params.tf = window.from;
    params.tt = window.to;
    clauses.push(`time(${localAt}) >= time(@tf) AND time(${localAt}) <= time(@tt)`);
  }

  if (q) {
    clauses.push('i.id LIKE @q COLLATE NOCASE');
    params.q = `%${q}%`;
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const db = connectDb();
  return db
    .prepare(
      `
      SELECT i.id, i.created_at AS createdAt, i.item_count AS itemCount,
             i.subtotal, i.discount, i.tax, i.total, i.type,
             i.payment_status AS paymentStatus,
             (
               SELECT GROUP_CONCAT(ii.name, ', ')
               FROM invoice_items ii
               WHERE ii.invoice_id = i.id AND ii.is_returned = 0
             ) AS items
      FROM invoices i
      ${where}
      ORDER BY i.created_at DESC, i.id DESC
    `
    )
    .all(params)
    .map((row) => ({
      ...row,
      items: row.items || '',
    }));
}
