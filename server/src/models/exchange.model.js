/**
 * Exchange events — previous-exchange popup + checkout audit rows.
 */
import { connectDb } from '../config/database.js';

export function insertEvent(row) {
  const db = connectDb();
  db.prepare(
    `
    INSERT INTO exchange_events (
      id, invoice_id, tab_id, exchanged_fingerprint, replacement_fingerprint,
      exchanged_credit, replacement_total, net_due, items_json
    ) VALUES (
      @id, @invoiceId, @tabId, @exchangedFingerprint, @replacementFingerprint,
      @exchangedCredit, @replacementTotal, @netDue, @itemsJson
    )
  `
  ).run(row);
}

export function listByInvoice(invoiceId) {
  const db = connectDb();
  return db
    .prepare(
      `
    SELECT id, invoice_id AS invoiceId, tab_id AS tabId,
           exchanged_fingerprint AS exchangedFingerprint,
           replacement_fingerprint AS replacementFingerprint,
           exchanged_credit AS exchangedCredit,
           replacement_total AS replacementTotal,
           net_due AS netDue, items_json AS itemsJson,
           created_at AS createdAt
    FROM exchange_events
    WHERE invoice_id = ?
    ORDER BY created_at ASC
  `
    )
    .all(invoiceId)
    .map((row) => {
      let given = [];
      let received = [];
      try {
        const parsed = JSON.parse(row.itemsJson || '{}');
        given = parsed.given || [];
        received = parsed.received || [];
      } catch {
        given = [];
        received = [];
      }
      return {
        id: row.id,
        invoiceId: row.invoiceId,
        tabId: row.tabId,
        exchangedCredit: row.exchangedCredit,
        replacementTotal: row.replacementTotal,
        netDue: row.netDue,
        given,
        received,
        createdAt: row.createdAt,
      };
    });
}
