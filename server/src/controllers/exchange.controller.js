import { v4 as uuid } from 'uuid';
import {
  ACTIVITY_ACTION,
  CASH_MOVEMENT_TYPE,
  ERROR_CODE,
  INVOICE_TYPE,
  NOTIFICATION_SOURCE,
  PAYMENT_STATUS,
} from '../config/constants.js';
import { success, error } from '../shared/utils/response.js';
import { money } from '../shared/utils/money.util.js';
import { publicTab, requireDrawer } from '../shared/utils/sale.util.js';
import { printPayload } from '../shared/utils/invoice.util.js';
import { lineFingerprint } from '../shared/utils/fingerprint.js';
import { snapshotLine } from '../shared/utils/exchange.util.js';
import * as invoiceModel from '../models/invoice.model.js';
import * as exchangeModel from '../models/exchange.model.js';
import * as saleModel from '../models/sale.model.js';
import * as outboxHooks from '../modules/sync/outboxHooks.js';
import * as posCounterModel from '../models/posCounter.model.js';

// Start exchange from an invoice — loads a tab in mode=exchange
export function start(req, res) {
  try {
    const drawer = requireDrawer(
      req.auth.employeeId,
      'Open cash drawer before starting an exchange'
    );
    const invoiceId = req.params.id;
    const invoice = invoiceModel.findById(invoiceId);
    if (!invoice) return error(res, 'Invoice not found', 404);

    const allItems = invoiceModel.listItems(invoiceId);
    const remaining = allItems.filter((i) => !i.isReturned);
    if (!remaining.length) {
      return error(res, 'Cannot exchange a fully returned invoice', 400);
    }

    const wanted = [...new Set(req.body.itemIds)];
    if (!wanted.length) {
      return error(res, 'Select at least one item to exchange', 400);
    }
    const byId = new Map(allItems.map((i) => [i.id, i]));
    const selected = [];
    for (const id of wanted) {
      const line = byId.get(id);
      if (!line) return error(res, `Invoice line not found: ${id}`, 400);
      if (line.isReturned) return error(res, `Line already returned: ${id}`, 400);
      selected.push(line);
    }

    const exchangedCredit = money(selected.reduce((s, line) => s + Number(line.lineTotal), 0));
    const exchangedFingerprint = lineFingerprint(selected);
    const exchangedItemIds = JSON.stringify(selected.map((i) => i.id));
    const given = selected.map(snapshotLine);

    const result = saleModel.runTx(() => {
      let tab = saleModel.findOpenExchangeTab(req.auth.employeeId, drawer.id, invoiceId);
      if (tab) {
        // Update given set only — keep replacement cart lines intact
        saleModel.updateExchangeTab({
          id: tab.id,
          employeeId: req.auth.employeeId,
          exchangedCredit,
          exchangedFingerprint,
          exchangedItemIds,
        });
        tab = saleModel.findOpenTab(tab.id, req.auth.employeeId);
      } else {
        tab = saleModel.createExchangeTab({
          id: uuid(),
          cashDrawerId: drawer.id,
          employeeId: req.auth.employeeId,
          authSessionId: req.auth.sessionId,
          exchangeInvoiceId: invoiceId,
          exchangedCredit,
          exchangedFingerprint,
          exchangedItemIds,
        });
      }

      const cartItems = saleModel.listItems(tab.id);
      return {
        tab: publicTab(tab, cartItems, { given }),
        invoiceId,
        exchangedCredit,
        exchangedFingerprint,
        given,
      };
    });

    return success(res, result, 201);
  } catch (err) {
    return error(res, err.message || 'Failed to start exchange', err.statusCode || 500, err.code || null);
  }
}

// Previous exchange items popup
export function listByInvoice(req, res) {
  try {
    const invoice = invoiceModel.findById(req.params.id);
    if (!invoice) return error(res, 'Invoice not found', 404);
    const events = exchangeModel.listByInvoice(req.params.id);
    return success(res, { invoiceId: invoice.id, events });
  } catch (err) {
    return error(res, err.message || 'Failed to list exchanges', err.statusCode || 500, err.code || null);
  }
}

// Called from sale checkout when tab.mode === exchange
export function checkoutExchange(req, res, { drawer, tab }) {
  try {
    const cartItems = saleModel.listItems(tab.id).filter((i) => Number(i.qty) > 0);
    if (!cartItems.length) {
      return error(res, 'Cart is empty', 400, ERROR_CODE.EMPTY_CART);
    }

    const replacementFingerprint = lineFingerprint(cartItems);
    if (replacementFingerprint === tab.exchangedFingerprint) {
      return error(
        res,
        'Replacement is the same as the original.',
        400,
        ERROR_CODE.SAME_REPLACEMENT
      );
    }

    let exchangedItemIds = [];
    try {
      exchangedItemIds = JSON.parse(tab.exchangedItemIds || '[]');
    } catch {
      exchangedItemIds = [];
    }
    if (!exchangedItemIds.length || !tab.exchangeInvoiceId) {
      return error(res, 'Exchange tab is missing original invoice lines', 400);
    }

    const invoiceId = tab.exchangeInvoiceId;
    const invoice = invoiceModel.findById(invoiceId);
    if (!invoice) return error(res, 'Invoice not found', 404);

    const originalItems = invoiceModel.listItems(invoiceId);
    const exchangedLines = originalItems.filter((i) => exchangedItemIds.includes(i.id));
    if (exchangedLines.length !== exchangedItemIds.length) {
      return error(res, 'Original exchange lines are no longer on the invoice', 400);
    }

    const bill = saleModel.computeTotals(cartItems);
    const exchangedCredit = money(tab.exchangedCredit || 0);
    const netDue = money(bill.total - exchangedCredit);

    const tendered = money(req.body.tendered);
    if (netDue > 0 && tendered < netDue) {
      return error(res, 'Tendered amount is less than net due', 400, ERROR_CODE.INSUFFICIENT_TENDER);
    }

    const cashIn = netDue > 0 ? netDue : 0;
    const cashOut = netDue < 0 ? money(Math.abs(netDue)) : 0;
    const changeDue = netDue > 0 ? money(tendered - netDue) : cashOut;
    const paymentStatus = netDue === 0 ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.ADJUST;

    const keptLines = originalItems.filter(
      (i) => !exchangedItemIds.includes(i.id) && !i.isReturned
    );

    const result = saleModel.runTx(() => {
      for (const line of exchangedLines) {
        saleModel.incrementStock(line.productId, line.qty);
        saleModel.insertSaleInventory({
          id: uuid(),
          productId: line.productId,
          qtyDelta: line.qty,
          reason: 'exchange',
          invoiceId,
        });
        invoiceModel.deleteItem(line.id, invoiceId);
      }

      for (const line of bill.lineDetails) {
        saleModel.assertAndDecrementStock(line.productId, line.qty);
        saleModel.insertSaleInventory({
          id: uuid(),
          productId: line.productId,
          qtyDelta: -line.qty,
          reason: 'exchange',
          invoiceId,
        });
      }

      const keptAsCart = keptLines.map((line) => ({
        productId: line.productId,
        sku: line.sku,
        name: line.name,
        qty: line.qty,
        unitPrice: line.unitPrice,
        discount: line.discount || 0,
      }));
      const combined = saleModel.computeTotals([...keptAsCart, ...cartItems]);

      invoiceModel.deleteTaxes(invoiceId);
      const receivedItems = [];
      for (const line of bill.lineDetails) {
        const itemId = uuid();
        receivedItems.push({
          id: itemId,
          productId: line.productId,
          sku: line.sku,
          name: line.name,
          qty: line.qty,
          unitPrice: line.unitPrice,
          discount: line.discount || 0,
          tax: line.lineTax,
          lineTotal: line.lineTotal,
        });
        invoiceModel.insertItem({
          id: itemId,
          invoiceId,
          productId: line.productId,
          sku: line.sku,
          name: line.name,
          qty: line.qty,
          unitPrice: line.unitPrice,
          discount: line.discount || 0,
          tax: line.lineTax,
          lineTotal: line.lineTotal,
        });
      }

      for (const tax of combined.taxes) {
        invoiceModel.insertTax({
          id: uuid(),
          invoiceId,
          taxRuleId: tax.id,
          name: tax.name,
          rate: tax.rate,
          amount: tax.amount,
        });
      }

      invoiceModel.updateHeader({
        id: invoiceId,
        type: INVOICE_TYPE.EXCHANGE,
        paymentStatus,
        itemCount: combined.lineDetails.length,
        subtotal: combined.afterDiscount,
        discount: combined.discountTotal,
        tax: combined.taxTotal,
        total: combined.total,
        tendered: netDue > 0 ? tendered : 0,
        changeDue,
        netDue,
      });

      if (cashIn > 0) {
        saleModel.insertSaleCashMovement({
          id: uuid(),
          cashDrawerId: drawer.id,
          type: CASH_MOVEMENT_TYPE.SALE_IN,
          amount: cashIn,
          invoiceId,
        });
      }
      if (cashOut > 0) {
        saleModel.insertSaleCashMovement({
          id: uuid(),
          cashDrawerId: drawer.id,
          type: CASH_MOVEMENT_TYPE.REFUND_OUT,
          amount: cashOut,
          invoiceId,
        });
      }

      exchangeModel.insertEvent({
        id: uuid(),
        invoiceId,
        tabId: tab.id,
        exchangedFingerprint: tab.exchangedFingerprint,
        replacementFingerprint,
        exchangedCredit,
        replacementTotal: bill.total,
        netDue,
        itemsJson: JSON.stringify({
          given: exchangedLines.map(snapshotLine),
          received: receivedItems,
        }),
      });

      invoiceModel.insertHistory({
        id: uuid(),
        invoiceId,
        actorId: req.auth.employeeId,
        text: `Exchange: credit Rs. ${exchangedCredit.toFixed(2)} → replacement Rs. ${bill.total.toFixed(2)}; net Rs. ${netDue.toFixed(2)}`,
      });

      saleModel.markTabCheckedOut(tab.id);
      const newTab = saleModel.createTab({
        id: uuid(),
        cashDrawerId: drawer.id,
        employeeId: req.auth.employeeId,
        authSessionId: req.auth.sessionId,
      });

      saleModel.insertSaleActivity({
        id: uuid(),
        employeeId: req.auth.employeeId,
        action: ACTIVITY_ACTION.EXCHANGE,
        entityType: 'invoice',
        entityId: invoiceId,
        details: JSON.stringify({
          exchangedCredit,
          replacementTotal: bill.total,
          netDue,
          tendered,
          changeDue,
        }),
      });

      saleModel.insertSaleNotification({
        id: uuid(),
        employeeId: req.auth.employeeId,
        source: NOTIFICATION_SOURCE.SYSTEM,
        title: 'Exchange completed',
        body: `Invoice ${invoiceId} — net Rs. ${netDue.toFixed(2)}`,
      });

      outboxHooks.queueExchangeEvents({
        invoice: {
          id: invoiceId,
          employeeId: req.auth.employeeId,
          paymentMethod: 'cash',
          subtotal: combined.afterDiscount,
          discount: combined.discountTotal,
          tax: combined.taxTotal,
          total: combined.total,
        },
        exchangedLines,
        receivedLines: receivedItems,
        exchangedCredit,
        replacementTotal: bill.total,
        netDue,
        tendered,
        changeDue,
        taxes: combined.taxes,
        employee: { id: req.auth.employeeId },
        counter: posCounterModel.resolveCounterForSync(),
      });

      const bundle = invoiceModel.getBundle(invoiceId);
      return {
        invoice: bundle.invoice,
        items: bundle.items,
        taxes: bundle.taxes,
        store: bundle.store,
        history: bundle.history,
        exchangedCredit,
        replacementTotal: bill.total,
        netDue,
        tendered: netDue > 0 ? tendered : 0,
        changeDue,
        print: printPayload(bundle, {
          slipType: 'exchange',
          exchangedCredit,
          replacementTotal: bill.total,
          netDue,
          given: exchangedLines.map(snapshotLine),
          received: receivedItems,
        }),
        closedTabId: tab.id,
        newTab: publicTab(newTab, []),
      };
    });

    return success(res, result, 201);
  } catch (err) {
    return error(res, err.message || 'Exchange checkout failed', err.statusCode || 500, err.code || null);
  }
}
