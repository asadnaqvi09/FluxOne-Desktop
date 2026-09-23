export const ROLES = Object.freeze({
  ADMIN: 'admin',
  CASHIER: 'cashier',
  /** @deprecated Legacy seed role — use admin (Branch Manager) for variance approval */
  SUPERVISOR: 'supervisor',
});

export const AUTH_TTL_HOURS = 24;
export const IDLE_MINUTES = 15;
export const VARIANCE_PIN_THRESHOLD = 500;
export const DEFAULT_PAGE_SIZE = 10;
export const SHOP_OPEN_TIME = '09:00';
export const SHOP_CLOSE_TIME = '18:00';
/** Store wall clock. Pakistan does not use DST. SQLite created_at is UTC. */
export const SHOP_TIME_ZONE = 'Asia/Karachi';
export const SHOP_SQLITE_LOCAL_OFFSET = '+5 hours';
/** Cashier catalog warns when remaining stock is below this (still sellable if > 0). */
export const LOW_STOCK_THRESHOLD = 10;

export const CASH_DRAWER_STATUS = Object.freeze({
  OPEN: 'open',
  CLOSED: 'closed',
});

export const TAB_STATUS = Object.freeze({
  OPEN: 'open',
  CHECKED_OUT: 'checked_out',
  VOID: 'void',
});

export const TAB_MODE = Object.freeze({
  SALE: 'sale',
  EXCHANGE: 'exchange',
});

export const INVOICE_TYPE = Object.freeze({
  SALE: 'Sale',
  RETURN: 'Return',
  EXCHANGE: 'Exchange',
});

export const PAYMENT_STATUS = Object.freeze({
  PAID: 'Paid',
  RETURN: 'Return',
  ADJUST: 'Adjust',
});

export const CASH_MOVEMENT_TYPE = Object.freeze({
  OPENING: 'opening',
  SALE_IN: 'sale_in',
  REFUND_OUT: 'refund_out',
});

export const ACTIVITY_ACTION = Object.freeze({
  LOGIN: 'login',
  LOGOUT: 'logout',
  LOCK: 'lock',
  UNLOCK: 'unlock',
  SYNC: 'sync',
  OPEN_CASH_DRAWER: 'open_cash_drawer',
  CLOSE_CASH_DRAWER: 'close_cash_drawer',
  SALE: 'sale',
  RETURN: 'return',
  EXCHANGE: 'exchange',
  PRICE_CHANGE: 'price_change',
  ASSIGN_CASHIER: 'assign_cashier',
  CHANGE_CASHIER: 'change_cashier',
});

export const NOTIFICATION_SOURCE = Object.freeze({
  SYSTEM: 'system',
  ADMIN: 'admin',
});

export const NOTIFICATION_AUDIENCE = Object.freeze({
  CASHIER: 'cashier',
  ADMIN: 'admin',
  ALL: 'all',
});

export const ERROR_CODE = Object.freeze({
  CLOSE_CASH_DRAWER_REQUIRED: 'CLOSE_CASH_DRAWER_REQUIRED',
  CASH_DRAWER_OPEN: 'CASH_DRAWER_OPEN',
  CASH_DRAWER_CLOSED: 'CASH_DRAWER_CLOSED',
  SYNC_REQUIRED: 'SYNC_REQUIRED',
  OFFLINE: 'OFFLINE',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SAME_REPLACEMENT: 'SAME_REPLACEMENT',
  REMARKS_REQUIRED: 'REMARKS_REQUIRED',
  VARIANCE_PIN_REQUIRED: 'VARIANCE_PIN_REQUIRED',
  CARTS_NOT_EMPTY: 'CARTS_NOT_EMPTY',
  INSUFFICIENT_TENDER: 'INSUFFICIENT_TENDER',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  EMPTY_CART: 'EMPTY_CART',
});
