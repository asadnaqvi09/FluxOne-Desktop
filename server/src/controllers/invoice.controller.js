import { success, error } from '../shared/utils/response.js';
import {
  publicItem,
  publicInvoiceRow,
  printPayload,
} from '../shared/utils/invoice.util.js';
import * as invoiceModel from '../models/invoice.model.js';

// Re-export for any older imports that expected printPayload on the controller
export { printPayload };

// List — date + time-to-time + invoice ID search
export function list(req, res) {
  try {
    const q = req.validatedQuery || {};
    const invoices = invoiceModel.listInvoices(q).map(publicInvoiceRow);
    return success(res, { invoices, count: invoices.length });
  } catch (err) {
    return error(res, err.message || 'Failed to list invoices', err.statusCode || 500, err.code || null);
  }
}

// Detail
export function getById(req, res) {
  try {
    const bundle = invoiceModel.getBundle(req.params.id);
    if (!bundle) return error(res, 'Invoice not found', 404);
    return success(res, {
      invoice: {
        ...publicInvoiceRow(bundle.invoice),
        cashDrawerId: bundle.invoice.cashDrawerId,
        employeeId: bundle.invoice.employeeId,
        employeeName: bundle.invoice.employeeName || null,
        tendered: bundle.invoice.tendered,
        changeDue: bundle.invoice.changeDue,
        netDue: bundle.invoice.netDue,
      },
      items: bundle.items.map(publicItem),
      taxes: bundle.taxes,
      store: bundle.store,
      history: bundle.history,
    });
  } catch (err) {
    return error(res, err.message || 'Failed to load invoice', err.statusCode || 500, err.code || null);
  }
}

// Print / reprint slip
export function print(req, res) {
  try {
    const bundle = invoiceModel.getBundle(req.params.id);
    if (!bundle) return error(res, 'Invoice not found', 404);
    return success(res, {
      print: printPayload(bundle),
      invoice: publicInvoiceRow(bundle.invoice),
      items: bundle.items.map(publicItem),
      taxes: bundle.taxes,
      store: bundle.store,
    });
  } catch (err) {
    return error(res, err.message || 'Failed to load print payload', err.statusCode || 500, err.code || null);
  }
}
