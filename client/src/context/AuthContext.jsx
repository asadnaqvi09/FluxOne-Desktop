import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { toast } from 'sonner'
import { formatMoney } from '@/lib/formatCurrency'
import { parseApiDate } from '@/api/result'
import { useAuthSession } from '@/hooks/useAuthSession'
import { useSync } from '@/hooks/useSync'
import { useCashDrawer } from '@/hooks/useCashDrawer'
import { useIdleLock } from '@/hooks/useIdleLock'
import { useAppDispatch } from '@/rtk/hooks'
import { fetchNotifications } from '@/rtk/features/notifications/notificationsSlice'
import { setDesktopCashDrawerOpen } from '@/lib/desktop'
import i18n from '@/i18n'

const AuthContext = createContext(null)

const FUNNEL_SYNC_KEY = 'fluxone.cashierFunnelNeedsSync'

function readFunnelNeedsSync(sessionId) {
  if (!sessionId || typeof sessionStorage === 'undefined') return false
  try {
    return sessionStorage.getItem(FUNNEL_SYNC_KEY) === String(sessionId)
  } catch {
    return false
  }
}

function writeFunnelNeedsSync(sessionId, needsSync) {
  if (typeof sessionStorage === 'undefined') return
  try {
    if (needsSync && sessionId) {
      sessionStorage.setItem(FUNNEL_SYNC_KEY, String(sessionId))
    } else {
      sessionStorage.removeItem(FUNNEL_SYNC_KEY)
    }
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Session UX + day-funnel gates.
 * Auth/lock/notifications/sync/cash drawer via API hooks.
 */
export function AuthProvider({ children }) {
  const dispatch = useAppDispatch()
  const {
    user,
    token,
    session,
    cashDrawerOpen: cashDrawerOpenFromApi,
    idleMinutes,
    sessionLocked: sessionLockedFromApi,
    isAuthenticated,
    authReady,
    isRestoring,
    login: apiLogin,
    logout: apiLogout,
    lockSession: apiLock,
    unlockSession: apiUnlock,
    updateProfile: apiUpdateProfile,
    isUpdatingProfile,
  } = useAuthSession()

  const { runSync: apiSync } = useSync({
    enablePolling: true,
    enableBackgroundSync: true,
  })
  const {
    openCashDrawer: apiOpenCashDrawer,
    closeCashDrawer: apiCloseCashDrawer,
    cashDrawer,
    refetchCurrent,
  } = useCashDrawer({
    skipCurrent: !isAuthenticated,
    skipExpected: true,
  })

  const [syncOkLocal, setSyncOk] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const [cashDrawerOpenLocal, setCashDrawerOpen] = useState(false)
  const [openingFloat, setOpeningFloat] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  /** True when this login required Sync (first use / after 24h) — drives step labels. */
  const [cashierFunnelNeedsSync, setCashierFunnelNeedsSync] = useState(false)
  const [sessionNoticePending, setSessionNoticePending] = useState(false)
  const [hydratedFromApi, setHydratedFromApi] = useState(false)

  const sessionLocked = Boolean(sessionLockedFromApi)

  // Prefer live session.syncOk from login/me/patchSession; local covers Sync Now
  // before the store catches up. Never treat device bootstrap as session sync.
  const syncOk = Boolean(session?.syncOk) || syncOkLocal
  const cashDrawerOpen =
    Boolean(cashDrawerOpenFromApi) ||
    Boolean(cashDrawer?.id) ||
    cashDrawerOpenLocal

  // —— Hydrate funnel extras from /auth/me on reload ——
  /* eslint-disable react-hooks/set-state-in-effect -- session hydrate / cash drawer mirror */
  useEffect(() => {
    if (!isAuthenticated || !session) return
    if (hydratedFromApi) return

    setSyncOk(Boolean(session.syncOk))
    setCashDrawerOpen(Boolean(cashDrawerOpenFromApi))
    if (session.lastSyncedAt) {
      setLastSyncedAt(parseApiDate(session.lastSyncedAt))
    }
    // Restore funnel step state: unfinished Sync, or same session that started with Sync
    const needsSync =
      !session.syncOk || readFunnelNeedsSync(session.id)
    setCashierFunnelNeedsSync(needsSync)
    if (needsSync && session.id) writeFunnelNeedsSync(session.id, true)
    setHydratedFromApi(true)
  }, [isAuthenticated, session, cashDrawerOpenFromApi, hydratedFromApi])

  useEffect(() => {
    // Only a real open drawer (has an id) unlocks POS. Empty API payloads
    // like `{ cashDrawer: null }` must not count as "open".
    if (!cashDrawer?.id) return
    setCashDrawerOpen(true)
    setSessionId(cashDrawer.id)
    setOpeningFloat(cashDrawer.openingFloat)
  }, [cashDrawer])

  useEffect(() => {
    if (!token) {
      setSyncOk(false)
      setLastSyncedAt(null)
      setCashDrawerOpen(false)
      setOpeningFloat(null)
      setSessionId(null)
      setCashierFunnelNeedsSync(false)
      writeFunnelNeedsSync(null, false)
      setSessionNoticePending(false)
      setHydratedFromApi(false)
    }
  }, [token])

  // Electron quit-guard: tell main process if till/cash drawer is open
  useEffect(() => {
    setDesktopCashDrawerOpen(cashDrawerOpen)
  }, [cashDrawerOpen])
  /* eslint-enable react-hooks/set-state-in-effect */

  /** Soft UX ping — real rows come from the server; invalidate list. */
  const pushNotification = useCallback(
    (message) => {
      if (message) toast.message(String(message))
      dispatch(fetchNotifications())
    },
    [dispatch],
  )

  const login = useCallback(
    async ({ userId, password }) => {
      // Stay on the login page (spinner + 24h modal). Do this BEFORE the API
      // so GuestGate does not jump to Sync while login is still running.
      setSessionNoticePending(true)
      const result = await apiLogin({ userId, password })
      if (!result.success) {
        setSessionNoticePending(false)
        return result
      }

      const sess = result.data.session || {}
      const role = result.data.role
      const sessionSynced = Boolean(sess.syncOk)
      const needsSyncFunnel = role === 'cashier' && !sessionSynced
      setSyncOk(sessionSynced)
      setSessionId(sess.id || null)
      setCashDrawerOpen(false)
      setOpeningFloat(null)
      setLastSyncedAt(parseApiDate(sess.lastSyncedAt))
      setCashierFunnelNeedsSync(needsSyncFunnel)
      writeFunnelNeedsSync(sess.id, needsSyncFunnel)
      setHydratedFromApi(true)
      dispatch(fetchNotifications())

      return {
        success: true,
        data: { role, syncOk: sessionSynced },
      }
    },
    [apiLogin, dispatch],
  )

  const acknowledgeSessionNotice = useCallback(() => {
    setSessionNoticePending(false)
  }, [])

  const logout = useCallback(async () => {
    const result = await apiLogout()
    if (!result.success) return result

    setSyncOk(false)
    setLastSyncedAt(null)
    setCashDrawerOpen(false)
    setOpeningFloat(null)
    setSessionId(null)
    setCashierFunnelNeedsSync(false)
    writeFunnelNeedsSync(null, false)
    setSessionNoticePending(false)
    setHydratedFromApi(false)
    return result
  }, [apiLogout])

  const runSync = useCallback(async () => {
    const result = await apiSync()
    if (!result.success) return result

    const syncOkFromApi = result.data?.syncOk !== false
    setSyncOk(syncOkFromApi)
    setLastSyncedAt(parseApiDate(result.data?.lastSyncedAt) || new Date())
    return result
  }, [apiSync])

  const openCashDrawer = useCallback(
    async (floatAmount) => {
      if (!syncOk) {
        return {
          success: false,
          error: 'Sync catalog before opening the cash drawer',
          code: 'SYNC_REQUIRED',
        }
      }
      const result = await apiOpenCashDrawer(floatAmount)
      if (!result.success) return result

      const drawer = result.data.cashDrawer
      setOpeningFloat(result.data.openingFloat)
      setCashDrawerOpen(true)
      setSessionId(result.data.sessionId)
      refetchCurrent?.()
      return {
        success: true,
        data: {
          openingFloat: result.data.openingFloat,
          sessionId: result.data.sessionId,
          cashDrawer: drawer,
          saleTab: result.data.saleTab,
        },
      }
    },
    [syncOk, apiOpenCashDrawer, refetchCurrent],
  )

  const closeCashDrawer = useCallback(
    async ({ countedCash, remarks, managerPassword, supervisorPin } = {}) => {
      const result = await apiCloseCashDrawer({
        countedCash,
        remarks,
        managerPassword,
        supervisorPin,
      })
      if (!result.success) return result

      setCashDrawerOpen(false)
      setOpeningFloat(null)
      setSessionId(null)
      const variance = result.data?.breakdown?.variance
      const counted = result.data?.breakdown?.countedCash
      toast.success(
        counted != null || variance != null
          ? i18n.t('closeCashDrawer.toastClosedDetailed', {
              counted: formatMoney(counted ?? 0),
              variance: formatMoney(variance ?? 0),
            })
          : i18n.t('closeCashDrawer.toastClosed'),
      )
      return result
    },
    [apiCloseCashDrawer],
  )

  const lockSession = useCallback(async () => {
    if (!user) return { success: false, error: i18n.t('profile.notSignedIn') }
    return apiLock()
  }, [user, apiLock])

  const unlockSession = useCallback(
    async ({ value } = {}) => {
      if (!user) return { success: false, error: i18n.t('profile.notSignedIn') }
      return apiUnlock({ value })
    },
    [user, apiUnlock],
  )

  const updateProfile = useCallback(
    async (patch) => {
      if (!user) return { success: false, error: i18n.t('profile.notSignedIn') }
      return apiUpdateProfile(patch)
    },
    [user, apiUpdateProfile],
  )

  useIdleLock({
    enabled: isAuthenticated && authReady,
    idleMinutes,
    locked: sessionLocked,
    onIdle: () => {
      if (!sessionLocked) lockSession()
    },
  })

  const value = useMemo(
    () => ({
      user,
      isAuthenticated,
      authReady,
      isRestoring,
      syncOk,
      cashierFunnelNeedsSync,
      lastSyncedAt,
      cashDrawerOpen,
      openingFloat,
      sessionId,
      sessionLocked,
      idleMinutes,
      sessionNoticePending,
      canAccessPos: Boolean(user?.role === 'cashier' && syncOk && cashDrawerOpen),
      login,
      logout,
      acknowledgeSessionNotice,
      runSync,
      openCashDrawer,
      closeCashDrawer,
      lockSession,
      unlockSession,
      updateProfile,
      isUpdatingProfile,
      pushNotification,
    }),
    [
      user,
      isAuthenticated,
      authReady,
      isRestoring,
      syncOk,
      cashierFunnelNeedsSync,
      lastSyncedAt,
      cashDrawerOpen,
      openingFloat,
      sessionId,
      sessionLocked,
      idleMinutes,
      sessionNoticePending,
      login,
      logout,
      acknowledgeSessionNotice,
      runSync,
      openCashDrawer,
      closeCashDrawer,
      lockSession,
      unlockSession,
      updateProfile,
      isUpdatingProfile,
      pushNotification,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- paired provider + hook
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
