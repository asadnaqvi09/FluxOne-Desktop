import { useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/rtk/hooks'
import {
  assignCashier as assignThunk,
  fetchCurrentCashier,
  fetchEmployees,
  selectAdminAssigning,
  selectAdminCurrentCashier,
  selectAdminEmployees,
  selectAdminError,
  selectAdminLoadingCashier,
  selectAdminLoadingEmployees,
  selectAdminUpdatingEmployee,
  updateEmployee as updateThunk,
} from '@/rtk/features/admin/adminSlice'
import { selectAuthToken } from '@/rtk/features/auth/authSlice'
import { toResultError } from '@/api/result'
import i18n from '@/i18n'

/**
 * Admin cashier assign + edit.
 */
export function useAdminCashiers({ skip = false } = {}) {
  const dispatch = useAppDispatch()
  const token = useAppSelector(selectAuthToken)
  const cashiers = useAppSelector(selectAdminEmployees)
  const assignedCashier = useAppSelector(selectAdminCurrentCashier)
  const loadingEmployees = useAppSelector(selectAdminLoadingEmployees)
  const loadingCashier = useAppSelector(selectAdminLoadingCashier)
  const assigning = useAppSelector(selectAdminAssigning)
  const updating = useAppSelector(selectAdminUpdatingEmployee)
  const error = useAppSelector(selectAdminError)

  useEffect(() => {
    if (skip || !token) return
    dispatch(fetchEmployees({ role: 'cashier' }))
    dispatch(fetchCurrentCashier())
  }, [skip, token, dispatch])

  const noCashierAssigned = error?.includes?.('404') || false
  // fetchCurrentCashier 404: store may keep error — treat missing cashier as ok
  const assignedCashierId = assignedCashier?.id || ''

  const assignCashier = useCallback(
    async (employeeId) => {
      const id = String(employeeId || '').trim()
      if (!id) return { success: false, error: i18n.t('cashiers.selectEmployee') }
      if (id === assignedCashierId) {
        return { success: false, error: i18n.t('cashiers.alreadyAssigned') }
      }
      try {
        const data = await dispatch(assignThunk({ employeeId: id })).unwrap()
        return { success: true, data: data.cashier }
      } catch (err) {
        return toResultError(err)
      }
    },
    [dispatch, assignedCashierId],
  )

  const updateCashier = useCallback(
    async (employeeId, patch) => {
      const id = String(employeeId || '').trim()
      if (!id) return { success: false, error: i18n.t('cashiers.selectToEdit') }
      try {
        const data = await dispatch(updateThunk({ id, ...patch })).unwrap()
        return { success: true, data: data.employee }
      } catch (err) {
        return toResultError(err)
      }
    },
    [dispatch],
  )

  return {
    cashiers: cashiers || [],
    assignedCashier,
    assignedCashierId,
    assignCashier,
    updateCashier,
    isAssigning: assigning,
    isUpdating: updating,
    isLoading: loadingEmployees || loadingCashier,
    isError: Boolean(error) && !noCashierAssigned && !assignedCashier,
    error:
      error && !assignedCashier
        ? toResultError({ message: error })
        : null,
    refetch: () => {
      dispatch(fetchEmployees({ role: 'cashier' }))
      dispatch(fetchCurrentCashier())
    },
  }
}

export default useAdminCashiers
