/**
 * Optional Electron bridge (window.fluxDesktop from preload).
 * Safe no-ops in the browser.
 */
export function isDesktopApp() {
  return Boolean(typeof window !== 'undefined' && window.fluxDesktop?.isDesktop)
}

export function setDesktopCashDrawerOpen(open) {
  try {
    window.fluxDesktop?.setCashDrawerOpen?.(Boolean(open))
  } catch {
    return false
  }
}

export async function desktopPrint() {
  if (!window.fluxDesktop?.print) return { success: false, usedFallback: true }
  try {
    const result = await window.fluxDesktop.print()
    return { ...result, usedFallback: false }
  } catch (err) {
    return { success: false, error: err?.message || 'Print failed', usedFallback: false }
  }
}

/** Electron main → renderer background sync trigger (debounced online + interval). */
export function subscribeDesktopBackgroundSync(handler) {
  if (typeof handler !== 'function') return () => {}
  try {
    const unsubscribe = window.fluxDesktop?.onBackgroundSync?.(handler)
    return typeof unsubscribe === 'function' ? unsubscribe : () => {}
  } catch {
    return () => {}
  }
}
