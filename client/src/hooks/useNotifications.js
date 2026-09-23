import { useCallback, useEffect, useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '@/rtk/hooks'
import {
  clearNotifications,
  fetchNotifications,
  markNotificationRead,
  selectNotifications,
  selectNotificationsClearing,
  selectNotificationsError,
  selectNotificationsLoading,
  selectNotificationsMarking,
  selectUnreadCount,
} from '@/rtk/features/notifications/notificationsSlice'
import { selectAuthToken } from '@/rtk/features/auth/authSlice'
import { toResultError } from '@/api/result'
import i18n from '@/i18n'

/**
 * Notifications list + mark read + clear.
 */
export function useNotifications({ skip = false, source } = {}) {
  const dispatch = useAppDispatch()
  const token = useAppSelector(selectAuthToken)
  const notifications = useAppSelector(selectNotifications)
  const unreadFromStore = useAppSelector(selectUnreadCount)
  const loading = useAppSelector(selectNotificationsLoading)
  const marking = useAppSelector(selectNotificationsMarking)
  const clearing = useAppSelector(selectNotificationsClearing)
  const error = useAppSelector(selectNotificationsError)

  const params = useMemo(() => (source ? { source } : undefined), [source])
  const canLoad = !skip && Boolean(token)

  useEffect(() => {
    if (!canLoad) return
    dispatch(fetchNotifications(params))
    const id = setInterval(() => {
      dispatch(fetchNotifications(params))
    }, 60_000)
    return () => clearInterval(id)
  }, [canLoad, params, dispatch])

  const unreadCount =
    unreadFromStore ?? notifications.filter((n) => !n.read).length

  const markRead = useCallback(
    async (id) => {
      if (!id)
        return { success: false, error: i18n.t('errors.notificationIdRequired') }
      try {
        await dispatch(markNotificationRead(id)).unwrap()
        return { success: true }
      } catch (err) {
        return toResultError(err)
      }
    },
    [dispatch],
  )

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.read)
    if (!unread.length) return { success: true }
    try {
      await Promise.all(
        unread.map((n) => dispatch(markNotificationRead(n.id)).unwrap()),
      )
      return { success: true }
    } catch (err) {
      return toResultError(err)
    }
  }, [notifications, dispatch])

  const clearAll = useCallback(async () => {
    try {
      await dispatch(clearNotifications()).unwrap()
      return { success: true }
    } catch (err) {
      return toResultError(err)
    }
  }, [dispatch])

  return {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    clearAll,
    refetch: () => dispatch(fetchNotifications(params)),
    isLoading: loading,
    isError: Boolean(error),
    error: error ? toResultError({ message: error }) : null,
    isMarking: marking,
    isClearing: clearing,
  }
}

export default useNotifications
