import i18n from '@/i18n'

/** Normalize API / RTK errors into { success: false, error, code, status } */
export function toResultError(err) {
  const message =
    (typeof err?.data === 'string' && err.data) ||
    err?.error ||
    err?.message ||
    i18n.t('errors.requestFailed')
  return {
    success: false,
    error: message,
    code: err?.code ?? null,
    status: err?.status ?? null,
    isNetworkError: Boolean(err?.isNetworkError),
  }
}

export const APP_TIME_ZONE = 'Asia/Karachi'
export const APP_TIME_ZONE_OFFSET = '+05:00'

export function parseApiDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  const raw = String(value).trim()
  const hasZone = /Z$|[+-]\d{2}:?\d{2}$/.test(raw)
  // SQLite datetime('now') is UTC with no zone. Treat naive strings as UTC.
  const normalized = hasZone ? raw : `${raw.replace(' ', 'T')}Z`
  const ms = Date.parse(normalized)
  if (!Number.isNaN(ms)) return new Date(ms)
  const fallback = new Date(value)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

/** ISO timestamp in Karachi / Islamabad (UTC+5). Pakistan does not use DST. */
export function toAppTimeIso(value) {
  const date = parseApiDate(value) || new Date()
  const wall = date.toLocaleString('sv-SE', { timeZone: APP_TIME_ZONE })
  return `${wall.replace(' ', 'T')}${APP_TIME_ZONE_OFFSET}`
}

/** Display time in Karachi / Islamabad, e.g. "17 Aug 2026, 4:48 PM". */
export function formatAppDateTime(value, fallback = '') {
  const date = parseApiDate(value)
  if (!date) return fallback
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date)
  const get = (type) => parts.find((p) => p.type === type)?.value || ''
  return `${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')} ${get('dayPeriod').toUpperCase()}`
}

/** Epoch ms for Redux / RTK cache (Date objects are non-serializable). */
export function toStoreTime(value, fallback = Date.now()) {
  const d = parseApiDate(value)
  if (d) return d.getTime()
  return typeof fallback === 'number' ? fallback : Date.now()
}
