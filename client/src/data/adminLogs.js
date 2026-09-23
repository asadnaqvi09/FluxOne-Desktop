/** Admin activity-log UI helpers. Log rows come from API via RTK.
 * Action display labels live in i18n (`activityLogs.actions.*`).
 */

export const LOG_ACTIONS = [
  { value: '' },
  { value: 'login' },
  { value: 'logout' },
  { value: 'sale' },
  { value: 'return' },
  { value: 'exchange' },
  { value: 'price_change' },
]

export function adminLogStats(logs) {
  const list = logs || []
  return {
    logins: list.filter((l) => l.action === 'login').length,
    sales: list.filter((l) => l.action === 'sale').length,
    returns: list.filter((l) => l.action === 'return').length,
    exchanges: list.filter((l) => l.action === 'exchange').length,
  }
}
