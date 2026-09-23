import { useCallback, useEffect, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '@/rtk/hooks'
import { selectAuthSession, selectAuthToken } from '@/rtk/features/auth/authSlice'
import {
  fetchSyncStatus,
  selectBootstrapDone,
  selectCloudConfigured,
  selectFailedOutbox,
  selectFailedEvents,
  selectLastPullAt,
  selectLastPushAt,
  selectPendingByType,
  selectPendingOutbox,
  selectSessionSyncOk,
  selectSyncError,
  selectSyncLastResult,
  selectSyncLoading,
  selectSyncMeta,
  selectSyncOk,
  selectSyncOnline,
  selectSyncStatusLoading,
  syncCatalog,
} from '@/rtk/features/sync/syncSlice'
import { toResultError } from '@/api/result'
import { subscribeDesktopBackgroundSync } from '@/lib/desktop'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

const STATUS_POLL_MS = 60_000
const BACKGROUND_SYNC_MS = 15 * 60 * 1000

// Catalog sync — GET /sync/status + POST /sync; desktop main can trigger background cycles.
export function useSync({
  enablePolling = false,
  enableBackgroundSync = false,
} = {}) {
  const dispatch = useAppDispatch()
  const token = useAppSelector(selectAuthToken)
  const authSession = useAppSelector(selectAuthSession)
  const loading = useAppSelector(selectSyncLoading)
  const statusLoading = useAppSelector(selectSyncStatusLoading)
  const error = useAppSelector(selectSyncError)
  const lastResult = useAppSelector(selectSyncLastResult)
  const syncOk = useAppSelector(selectSyncOk)
  const sessionSyncOk = useAppSelector(selectSessionSyncOk)
  const bootstrapDone = useAppSelector(selectBootstrapDone)
  const cloudConfigured = useAppSelector(selectCloudConfigured)
  const serverOnline = useAppSelector(selectSyncOnline)
  const pendingOutbox = useAppSelector(selectPendingOutbox)
  const failedOutbox = useAppSelector(selectFailedOutbox)
  const failedEvents = useAppSelector(selectFailedEvents)
  const pendingByType = useAppSelector(selectPendingByType)
  const lastPullAt = useAppSelector(selectLastPullAt)
  const lastPushAt = useAppSelector(selectLastPushAt)
  const meta = useAppSelector(selectSyncMeta)
  const { isOnline: browserOnline } = useOnlineStatus()
  const backgroundBusy = useRef(false)

  // Funnel: no auto sync until this login session has completed Sync once
  const sessionHasSynced = Boolean(authSession?.syncOk)

  const refreshStatus = useCallback(async () => {
    try {
      await dispatch(fetchSyncStatus()).unwrap()
      return { success: true }
    } catch (err) {
      return toResultError(err)
    }
  }, [dispatch])

  const runSync = useCallback(
    async ({ silent = false } = {}) => {
      try {
        const data = await dispatch(syncCatalog()).unwrap()
        return { success: true, data, silent }
      } catch (err) {
        return toResultError(err)
      }
    },
    [dispatch],
  )

  useEffect(() => {
    if (!token || !enablePolling) return undefined
    refreshStatus()
    const id = window.setInterval(() => {
      refreshStatus()
    }, STATUS_POLL_MS)
    return () => window.clearInterval(id)
  }, [token, enablePolling, refreshStatus])

  useEffect(() => {
    if (!token || !enableBackgroundSync || !bootstrapDone) return undefined
    // Keep login funnel as Sync → Cash Drawer (do not auto-mark session synced)
    if (!sessionHasSynced) return undefined

    const runBackgroundSync = async () => {
      if (backgroundBusy.current || loading) return
      if (!browserOnline) return
      backgroundBusy.current = true
      try {
        await runSync({ silent: true })
      } finally {
        backgroundBusy.current = false
      }
    }

    const unsubscribeDesktop = subscribeDesktopBackgroundSync(runBackgroundSync)
    const intervalId = window.setInterval(runBackgroundSync, BACKGROUND_SYNC_MS)

    return () => {
      unsubscribeDesktop()
      window.clearInterval(intervalId)
    }
  }, [
    token,
    enableBackgroundSync,
    bootstrapDone,
    sessionHasSynced,
    browserOnline,
    loading,
    runSync,
  ])

  return {
    runSync,
    refreshStatus,
    isOnline: browserOnline,
    serverOnline,
    isLoading: loading,
    isStatusLoading: statusLoading,
    isError: Boolean(error),
    error: error ? toResultError({ message: error }) : null,
    lastResult,
    syncOk,
    sessionSyncOk,
    bootstrapDone,
    cloudConfigured,
    pendingOutbox,
    failedOutbox,
    failedEvents,
    pendingByType,
    lastPullAt,
    lastPushAt,
    meta,
  }
}

export default useSync
