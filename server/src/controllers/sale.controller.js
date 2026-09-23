import { v4 as uuid } from 'uuid';
import {
  ACTIVITY_ACTION,
  CASH_MOVEMENT_TYPE,
  ERROR_CODE,
  INVOICE_TYPE,
  NOTIFICATION_SOURCE,
  PAYMENT_STATUS,
  TAB_MODE,
} from '../config/constants.js';
import { success, error } from '../shared/utils/response.js';
import { money } from '../shared/utils/money.util.js';
import {
  assertCartQtyAllowed,
  publicTab,
  requireDrawer,
  stockLowMessage,
} from '../shared/utils/sale.util.js';
import * as saleModel from '../models/sale.model.js';
import * as catalogModel from '../models/catalog.model.js';
import * as invoiceModel from '../models/invoice.model.js';
import { snapshotLine } from '../shared/utils/exchange.util.js';
import { checkoutExchange } from './exchange.controller.js';
import * as outboxHooks from '../modules/sync/outboxHooks.js';
import * as posCounterModel from '../models/posCounter.model.js';

function givenForExchangeTab(tab) {
  if (tab.mode !== TAB_MODE.EXCHANGE || !tab.exchangeInvoiceId) return [];
  let ids = [];
  try {
    ids = JSON.parse(tab.exchangedItemIds || '[]');
  } catch {
    ids = [];
  }
  if (!ids.length) return [];
  const idSet = new Set(ids);
  return invoiceModel
    .listItems(tab.exchangeInvoiceId)
    .filter((line) => idSet.has(line.id))
    .map(snapshotLine);
}

// List open sale tabs (+ items)
export function listTabs(req, res) {
  try {
    const drawer = requireDrawer(req.auth.employeeId);
    const tabs = saleModel.listOpenTabs(req.auth.employeeId, drawer.id).map((tab) => {
      const items = saleModel.listItems(tab.id);
      return publicTab(tab, items, { given: givenForExchangeTab(tab) });
    });
    return success(res, { tabs, cashDrawerId: drawer.id });
  } catch (err) {
    return error(res, err.message || 'Failed to list tabs', err.statusCode || 500, err.code || null);
  }
}

// New tab (+)
export function createTab(req, res) {
  try {
    const drawer = requireDrawer(req.auth.employeeId);
    const tab = saleModel.runTx(() =>
      saleModel.createTab({
        id: uuid(),
        cashDrawerId: drawer.id,
        employeeId: req.auth.employeeId,
        authSessionId: req.auth.sessionId,
      })
    );
    return success(res, { tab: publicTab(tab, []) }, 201);
  } catch (err) {
    return error(res, err.message || 'Failed to create tab', err.statusCode || 500, err.code || null);
  }
}

// Delete / void tab
export function deleteTab(req, res) {
  try {
    const drawer = requireDrawer(req.auth.employeeId);
    const tab = saleModel.findOpenTab(req.params.id, req.auth.employeeId);
    if (!tab || tab.cashDrawerId !== drawer.id) return error(res, 'Sale tab not found', 404);
    const openCount = saleModel.countOpenTabs(req.auth.employeeId, drawer.id);
    if (openCount <= 1) return error(res, 'At least one sale tab must remain open', 400);
    saleModel.runTx(() => {
      saleModel.voidTab(tab.id, req.auth.employeeId);
    });
    return success(res, { deleted: true, id: tab.id });
  } catch (err) {
    return error(res, err.message || 'Failed to delete tab', err.statusCode || 500, err.code || null);
  }
}

// Add item by sku or productId
export function addItem(req, res) {
  try {
    const drawer = requireDrawer(req.auth.employeeId);
    const tab = saleModel.findOpenTab(req.params.id, req.auth.employeeId);
    if (!tab || tab.cashDrawerId !== drawer.id) return error(res, 'Sale tab not found', 404);

    const product = req.body.productId
      ? catalogModel.findProductById(req.body.productId)
      : catalogModel.findBySkuOrBarcode(req.body.sku);
    if (!product) return error(res, 'Product not found', 404);

    const qty = req.body.qty ?? 1;
    const existing = saleModel.findItemByProduct(tab.id, product.id);
    const nextQty = (existing?.qty || 0) + qty;
    const stockCheck = assertCartQtyAllowed(product, nextQty);

    const line = saleModel.runTx(() => {
      if (existing) {
        return saleModel.updateItemQty(existing.id, tab.id, nextQty);
      }
      return saleModel.addItem({
        id: uuid(),
        tabId: tab.id,
        productId: product.id,
        sku: product.sku,
        name: product.name,
        qty,
        unitPrice: product.price,
        discount: product.discount || 0,
      });
    });

    return success(
      res,
      {
        item: line,
        stock: stockCheck.stock,
        lowStock: stockCheck.lowStock,
        warning: stockCheck.lowStock ? stockLowMessage(stockCheck.stock) : null,
      },
      201
    );
  } catch (err) {
    return error(res, err.message || 'Failed to add item', err.statusCode || 500, err.code || null);
  }
}

// Update line qty
export function updateItem(req, res) {
  try {
    const drawer = requireDrawer(req.auth.employeeId);
    const tab = saleModel.findOpenTab(req.params.id, req.auth.employeeId);
    if (!tab || tab.cashDrawerId !== drawer.id) return error(res, 'Sale tab not found', 404);
    const existing = saleModel.findItem(req.params.lineId, tab.id);
    if (!existing) return error(res, 'Cart line not found', 404);

    const qty = req.body.qty;
    if (qty > 0) {
      const product = catalogModel.findProductById(existing.productId);
      if (!product) return error(res, 'Product not found', 404);
      assertCartQtyAllowed(product, qty);
    }

    const item = saleModel.updateItemQty(existing.id, tab.id, qty);
    return success(res, { item });
  } catch (err) {
    return error(res, err.message || 'Failed to update item', err.statusCode || 500, err.code || null);
  }
}

// Remove line
export function removeItem(req, res) {
  try {
    const drawer = requireDrawer(req.auth.employeeId);
    const tab = saleModel.findOpenTab(req.params.id, req.auth.employeeId);
    if (!tab || tab.cashDrawerId !== drawer.id) return error(res, 'Sale tab not found', 404);
    const ok = saleModel.removeItem(req.params.lineId, tab.id);
    if (!ok) return error(res, 'Cart line not found', 404);
    return success(res, { deleted: true, id: req.params.lineId });
  } catch (err) {
    return error(res, err.message || 'Failed to remove item', err.statusCode || 500, err.code || null);
  }
}

// Bill totals — actual, after discount, N taxes, total
export function totals(req, res) {
  try {
    const drawer = requireDrawer(req.auth.employeeId);
    const tab = saleModel.findOpenTab(req.params.id, req.auth.employeeId);
    if (!tab || tab.cashDrawerId !== drawer.id) return error(res, 'Sale tab not found', 404);
    const items = saleModel.listItems(tab.id);
    const bill = saleModel.computeTotals(items);
    const exchangedCredit = money(tab.exchangedCredit || 0);
    const netDue =
      tab.mode === TAB_MODE.EXCHANGE ? money(bill.total - exchangedCredit) : bill.total;
    return success(res, {
      tabId: tab.id,
      mode: tab.mode,
      actual: bill.actual,
      afterDiscount: bill.afterDiscount,
      taxes: bill.taxes,
      taxTotal: bill.taxTotal,
      total: bill.total,
      exchangedCredit: tab.mode === TAB_MODE.EXCHANGE ? exchangedCredit : 0,
      netDue,
    });
  } catch (err) {
    return error(res, err.message || 'Failed to compute totals', err.statusCode || 500, err.code || null);
  }
}

// Checkout (cash only) — Phase 1.7
export function checkout(req, res) {
  try {
    const drawer = requireDrawer(req.auth.employeeId);
    const tab = saleModel.findOpenTab(req.params.id, req.auth.employeeId);
    if (!tab || tab.cashDrawerId !== drawer.id) return error(res, 'Sale tab not found', 404);
    if (tab.mode === TAB_MODE.EXCHANGE) {
      return checkoutExchange(req, res, { drawer, tab });
    }

    const cartItems = saleModel.listItems(tab.id).filter((i) => Number(i.qty) > 0);
    if (!cartItems.length) {
      return error(res, 'Cart is empty', 400, ERROR_CODE.EMPTY_CART);
    }

    const bill = saleModel.computeTotals(cartItems);
    const tendered = money(req.body.tendered);
    if (tendered < bill.total) {
      return error(res, 'Tendered amount is less than total', 400, ERROR_CODE.INSUFFICIENT_TENDER);
    }
    const changeDue = money(tendered - bill.total);

    const result = saleModel.runTx(() => {
      for (const line of bill.lineDetails) {
        saleModel.assertAndDecrementStock(line.productId, line.qty);
      }

      const invoiceId = saleModel.nextInvoiceId();
      saleModel.insertSaleInvoice({
        id: invoiceId,
        cashDrawerId: drawer.id,
        employeeId: req.auth.employeeId,
        type: INVOICE_TYPE.SALE,
        paymentStatus: PAYMENT_STATUS.PAID,
        itemCount: bill.lineDetails.length,
        subtotal: bill.afterDiscount,
        discount: bill.discountTotal,
        tax: bill.taxTotal,
        total: bill.total,
        tendered,
        changeDue,
        netDue: 0,
      });

      const saleItems = [];
      for (const line of bill.lineDetails) {
        const itemId = uuid();
        saleItems.push({
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
        saleModel.insertSaleInvoiceItem({
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
        saleModel.insertSaleInventory({
          id: uuid(),
          productId: line.productId,
          qtyDelta: -line.qty,
          reason: 'sale',
          invoiceId,
        });
      }

      for (const tax of bill.taxes) {
        saleModel.insertSaleInvoiceTax({
          id: uuid(),
          invoiceId,
          taxRuleId: tax.id,
          name: tax.name,
          rate: tax.rate,
          amount: tax.amount,
        });
      }

      saleModel.insertSaleCashMovement({
        id: uuid(),
        cashDrawerId: drawer.id,
        type: CASH_MOVEMENT_TYPE.SALE_IN,
        amount: bill.total,
        invoiceId,
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
        action: ACTIVITY_ACTION.SALE,
        entityType: 'invoice',
        entityId: invoiceId,
        details: JSON.stringify({ total: bill.total, tendered, changeDue }),
      });

      saleModel.insertSaleNotification({
        id: uuid(),
        employeeId: req.auth.employeeId,
        source: NOTIFICATION_SOURCE.SYSTEM,
        title: 'Sale completed',
        body: `Invoice ${invoiceId} — Rs. ${bill.total.toFixed(2)}`,
      });

      outboxHooks.queueSaleEvent({
        invoice: {
          id: invoiceId,
          employeeId: req.auth.employeeId,
          type: INVOICE_TYPE.SALE,
          paymentMethod: 'cash',
          subtotal: bill.afterDiscount,
          discount: bill.discountTotal,
          tax: bill.taxTotal,
          total: bill.total,
          tendered,
          changeDue,
          netDue: 0,
        },
        items: saleItems,
        taxes: bill.taxes,
        employee: { id: req.auth.employeeId },
        counter: posCounterModel.resolveCounterForSync(),
      });

      const bundle = saleModel.getInvoiceBundle(invoiceId);
      return {
        invoice: bundle.invoice,
        items: bundle.items,
        taxes: bundle.taxes,
        store: bundle.store,
        print: {
          invoiceId,
          type: bundle.invoice.type,
          paymentStatus: bundle.invoice.paymentStatus,
          createdAt: bundle.invoice.createdAt,
          items: bundle.items,
          subtotal: bundle.invoice.subtotal,
          discount: bundle.invoice.discount,
          tax: bundle.invoice.tax,
          total: bundle.invoice.total,
          tendered: bundle.invoice.tendered,
          changeDue: bundle.invoice.changeDue,
          store: bundle.store,
        },
        closedTabId: tab.id,
        newTab: publicTab(newTab, []),
      };
    });

    return success(res, result, 201);
  } catch (err) {
    return error(res, err.message || 'Checkout failed', err.statusCode || 500, err.code || null);
  }
}
