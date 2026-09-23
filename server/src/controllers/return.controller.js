import { v4 as uuid } from 'uuid';
import {
  ACTIVITY_ACTION,
  CASH_MOVEMENT_TYPE,
  INVOICE_TYPE,
  NOTIFICATION_SOURCE,
  PAYMENT_STATUS,
} from '../config/constants.js';
import { success, error } from '../shared/utils/response.js';
import { money } from '../shared/utils/money.util.js';
import { requireDrawer } from '../shared/utils/sale.util.js';
import { printPayload } from '../shared/utils/invoice.util.js';
import * as invoiceModel from '../models/invoice.model.js';
import * as returnModel from '../models/return.model.js';
import * as saleModel from '../models/sale.model.js';
import * as outboxHooks from '../modules/sync/outboxHooks.js';
import * as posCounterModel from '../models/posCounter.model.js';

// Return selected invoice lines (itemIds = invoice_items.id)
export function create(req, res) {
  try {
    const drawer = requireDrawer(
      req.auth.employeeId,
      'Open cash drawer before processing a return'
    );
    const invoiceId = req.params.id;
    const invoice = invoiceModel.findById(invoiceId);
    if (!invoice) return error(res, 'Invoice not found', 404);
    if (invoice.type === INVOICE_TYPE.RETURN && invoice.paymentStatus === PAYMENT_STATUS.RETURN) {
      const remaining = invoiceModel.listItems(invoiceId).filter((i) => !i.isReturned);
      if (!remaining.length) return error(res, 'Invoice has already been returned', 400);
    }

    if (returnModel.findOpenExchangeTab(invoiceId)) {
      return error(res, 'Finish or void the open exchange tab before returning', 409);
    }

    const wanted = [...new Set(req.body.itemIds)];
    const allItems = invoiceModel.listItems(invoiceId);
    const byId = new Map(allItems.map((i) => [i.id, i]));
    const selected = [];
    for (const id of wanted) {
      const line = byId.get(id);
      if (!line) return error(res, `Invoice line not found: ${id}`, 400);
      if (line.isReturned) return error(res, `Line already returned: ${id}`, 400);
      selected.push(line);
    }

    const refundAmount = money(selected.reduce((s, line) => s + Number(line.lineTotal), 0));

    const result = invoiceModel.runTx(() => {
      for (const line of selected) {
        const ok = invoiceModel.markItemReturned(line.id, invoiceId);
        if (!ok) {
          const err = new Error(`Line already returned: ${line.id}`);
          err.statusCode = 400;
          throw err;
        }
        returnModel.incrementStock(line.productId, line.qty);
        saleModel.insertSaleInventory({
          id: uuid(),
          productId: line.productId,
          qtyDelta: line.qty,
          reason: 'return',
          invoiceId,
        });
      }

      const remaining = invoiceModel.listItems(invoiceId).filter((i) => !i.isReturned);
      const isFullReturn = remaining.length === 0;

      let header;
      if (isFullReturn) {
        // Fully returned — zero header; type/status Return (blocks further exchange)
        header = {
          id: invoiceId,
          type: INVOICE_TYPE.RETURN,
          paymentStatus: PAYMENT_STATUS.RETURN,
          itemCount: 0,
          subtotal: 0,
          discount: 0,
          tax: 0,
          total: 0,
          tendered: invoice.tendered,
          changeDue: invoice.changeDue,
          netDue: 0,
        };
      } else {
        // Partial — keep Sale/Exchange type; recompute from remaining lines only
        const subtotal = money(
          remaining.reduce((s, i) => s + (Number(i.lineTotal) - Number(i.tax)), 0)
        );
        const discount = money(
          remaining.reduce((s, i) => s + Number(i.discount || 0) * Number(i.qty), 0)
        );
        const tax = money(remaining.reduce((s, i) => s + Number(i.tax), 0));
        const total = money(remaining.reduce((s, i) => s + Number(i.lineTotal), 0));
        header = {
          id: invoiceId,
          type: invoice.type === INVOICE_TYPE.RETURN ? INVOICE_TYPE.SALE : invoice.type,
          paymentStatus: invoice.paymentStatus === PAYMENT_STATUS.RETURN
            ? PAYMENT_STATUS.PAID
            : invoice.paymentStatus,
          itemCount: remaining.length,
          subtotal,
          discount,
          tax,
          total,
          tendered: invoice.tendered,
          changeDue: invoice.changeDue,
          netDue: total,
        };
      }
      invoiceModel.updateHeader(header);

      saleModel.insertSaleCashMovement({
        id: uuid(),
        cashDrawerId: drawer.id,
        type: CASH_MOVEMENT_TYPE.REFUND_OUT,
        amount: refundAmount,
        invoiceId,
      });

      invoiceModel.insertHistory({
        id: uuid(),
        invoiceId,
        actorId: req.auth.employeeId,
        text: `Returned ${selected.length} line(s); refund Rs. ${refundAmount.toFixed(2)}`,
      });

      saleModel.insertSaleActivity({
        id: uuid(),
        employeeId: req.auth.employeeId,
        action: ACTIVITY_ACTION.RETURN,
        entityType: 'invoice',
        entityId: invoiceId,
        details: JSON.stringify({
          itemIds: selected.map((i) => i.id),
          refundAmount,
        }),
      });

      saleModel.insertSaleNotification({
        id: uuid(),
        employeeId: req.auth.employeeId,
        source: NOTIFICATION_SOURCE.SYSTEM,
        title: 'Return completed',
        body: `Invoice ${invoiceId} — refund Rs. ${refundAmount.toFixed(2)}`,
      });

      outboxHooks.queueRefundEvent({
        invoice,
        returnedItems: selected,
        refundAmount,
        employee: { id: req.auth.employeeId },
        counter: posCounterModel.resolveCounterForSync(invoice.counterId),
      });

      const bundle = invoiceModel.getBundle(invoiceId);
      const stocks = selected.map((line) => ({
        productId: line.productId,
        sku: line.sku,
        stock: returnModel.getStock(line.productId)?.stock ?? null,
      }));

      return {
        invoice: bundle.invoice,
        items: bundle.items,
        taxes: bundle.taxes,
        store: bundle.store,
        history: bundle.history,
        refundAmount,
        returnedItems: selected,
        stocks,
        print: printPayload(bundle, {
          slipType: 'return',
          refundAmount,
          returnedItems: selected,
        }),
      };
    });

    return success(res, result);
  } catch (err) {
    return error(res, err.message || 'Return failed', err.statusCode || 500, err.code || null);
  }
}
