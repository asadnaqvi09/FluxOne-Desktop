import { ERROR_CODE, LOW_STOCK_THRESHOLD, TAB_MODE } from '../../config/constants.js';
import * as saleModel from '../../models/sale.model.js';

function parseExchangedItemIds(raw) {
  try {
    const ids = JSON.parse(raw || '[]');
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

/** Safe sale-tab fields for API responses. */
export function publicTab(tab, items = [], { given } = {}) {
  const isExchange = tab.mode === TAB_MODE.EXCHANGE;
  const exchangedItemIds = isExchange ? parseExchangedItemIds(tab.exchangedItemIds) : [];
  return {
    id: tab.id,
    tabIndex: tab.tabIndex,
    status: tab.status,
    mode: tab.mode,
    cashDrawerId: tab.cashDrawerId,
    exchangeInvoiceId: tab.exchangeInvoiceId || null,
    exchangedCredit: isExchange ? tab.exchangedCredit || 0 : 0,
    exchangedFingerprint: isExchange ? tab.exchangedFingerprint || null : null,
    exchangedItemIds,
    given: isExchange ? given || [] : [],
    itemCount: items.length,
    items,
  };
}

/** Require an open cash drawer for POS actions. */
export function requireDrawer(
  employeeId,
  message = 'Open cash drawer before using sale tabs'
) {
  const drawer = saleModel.findOpenCashDrawer(employeeId);
  if (!drawer) {
    const err = new Error(message);
    err.statusCode = 409;
    err.code = ERROR_CODE.CASH_DRAWER_CLOSED;
    throw err;
  }
  return drawer;
}

/** User-facing stock messages for cashiers. */
export function stockOutMessage(stock) {
  return `This item is out of stock. Stock: ${stock}. Contact/inform admin.`;
}

export function stockLowMessage(stock) {
  return `This item is low in stock. Stock: ${stock}. Contact/inform admin.`;
}

/**
 * Ensure requested qty fits available stock.
 * Throws App-style error when stock is insufficient.
 */
export function assertCartQtyAllowed(product, requestedQty) {
  const stock = Number(product?.stock) || 0;
  const qty = Number(requestedQty) || 0;
  if (stock <= 0 || qty > stock) {
    const err = new Error(stockOutMessage(stock));
    err.statusCode = 409;
    err.code = ERROR_CODE.INSUFFICIENT_STOCK;
    throw err;
  }
  return {
    stock,
    lowStock: stock > 0 && stock < LOW_STOCK_THRESHOLD,
  };
}
