/**
 * Shop wall clock is Pakistan (UTC+5, no DST).
 * SQLite datetime('now') stores UTC with no timezone suffix.
 * Compare filters against datetime(created_at, '+5 hours') so a picked
 * calendar day matches what the cashier sees on screen.
 */
import {
  SHOP_CLOSE_TIME,
  SHOP_OPEN_TIME,
  SHOP_SQLITE_LOCAL_OFFSET,
} from '../../config/constants.js';

export function padTime(value, { endOfMinute = false } = {}) {
  const raw = String(value || '').trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{2}:\d{2}$/.test(raw)) return endOfMinute ? `${raw}:59` : `${raw}:00`;
  return raw;
}

/** SQL expression: UTC created_at shifted to shop local time. */
export function shopLocalCreatedAt(alias = '') {
  const col = alias ? `${alias}.created_at` : 'created_at';
  return `datetime(${col}, '${SHOP_SQLITE_LOCAL_OFFSET}')`;
}

function isMinuteOnly(value) {
  return /^\d{2}:\d{2}$/.test(String(value || '').trim());
}

/**
 * Invoice list window in shop-local time.
 * date + optional From/To hours → one calendar day (or a slice of it).
 * hours only → same clock times on every day.
 */
export function invoiceShopWindow({ date, timeFrom, timeTo } = {}) {
  if (date) {
    const fromTime = padTime(timeFrom || '00:00:00');
    const toTime = timeTo
      ? padTime(timeTo, { endOfMinute: isMinuteOnly(timeTo) })
      : '23:59:59';
    return {
      kind: 'datetime',
      from: `${date} ${fromTime}`,
      to: `${date} ${toTime}`,
    };
  }
  if (timeFrom || timeTo) {
    return {
      kind: 'time',
      from: padTime(timeFrom || SHOP_OPEN_TIME),
      to: padTime(timeTo || SHOP_CLOSE_TIME, {
        endOfMinute: !timeTo || isMinuteOnly(timeTo),
      }),
    };
  }
  return null;
}

/**
 * Activity-log window in shop-local time.
 * `date` = that one shop day. `from` / `to` stay as YYYY-MM-DD range.
 */
export function auditShopWindow({ date, from, to } = {}) {
  const start = date || from;
  const end = date || to;
  if (!start && !end) return null;
  return {
    from: start ? `${start} 00:00:00` : null,
    to: end ? `${end} 23:59:59` : null,
  };
}
