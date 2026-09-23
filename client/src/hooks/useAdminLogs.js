import { useEffect, useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '@/rtk/hooks'
import {
  fetchAdminLogs,
  fetchEmployees,
  selectAdminEmployees,
  selectAdminError,
  selectAdminLoadingEmployees,
  selectAdminLoadingLogs,
  selectAdminLogs,
} from '@/rtk/features/admin/adminSlice'
import { selectAuthToken } from '@/rtk/features/auth/authSlice'
import { adminLogStats, filterMappedLogs } from '@/lib/mapAdmin'
import { toResultError } from '@/api/result'

/**
 * Admin activity logs — empty date = all; picked date is one shop day on the server.
 * Action / cashier are filtered client-side.
 */
export function useAdminLogs({
  date = '',
  from = '',
  to = '',
  action = '',
  cashierId = '',
  skip = false,
} = {}) {
  const dispatch = useAppDispatch()
  const token = useAppSelector(selectAuthToken)
  const logs = useAppSelector(selectAdminLogs)
  const cashiers = useAppSelector(selectAdminEmployees)
  const loadingLogs = useAppSelector(selectAdminLoadingLogs)
  const loadingEmployees = useAppSelector(selectAdminLoadingEmployees)
  const error = useAppSelector(selectAdminError)

  const params = useMemo(() => {
    const p = {}
    if (date) {
      p.date = date
      return p
    }
    if (from) p.from = from
    if (to) p.to = to
    return p
  }, [date, from, to])

  useEffect(() => {
    if (skip || !token) return
    dispatch(fetchAdminLogs(params))
    dispatch(fetchEmployees({ role: 'cashier' }))
  }, [skip, token, params, dispatch])

  const filtered = useMemo(
    () => filterMappedLogs(logs, { action, cashierId }),
    [logs, action, cashierId],
  )

  const stats = useMemo(() => adminLogStats(filtered), [filtered])

  return {
    logs: filtered,
    allLogs: logs,
    stats,
    cashiers,
    isLoading: loadingLogs || loadingEmployees,
    isError: Boolean(error),
    error: error ? toResultError({ message: error }) : null,
    refetch: () => {
      dispatch(fetchAdminLogs(params))
      dispatch(fetchEmployees({ role: 'cashier' }))
    },
  }
}

export default useAdminLogs
