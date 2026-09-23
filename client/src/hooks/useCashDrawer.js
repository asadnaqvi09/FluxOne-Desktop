import { useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/rtk/hooks'
import {
  closeCashDrawer as closeThunk,
  fetchCurrentCashDrawer,
  fetchExpectedCashDrawer,
  openCashDrawer as openThunk,
  selectCashDrawerClosing,
  selectCashDrawerCurrent,
  selectCashDrawerError,
  selectCashDrawerExpected,
  selectCashDrawerLoadingCurrent,
  selectCashDrawerLoadingExpected,
  selectCashDrawerOpening,
} from '@/rtk/features/cashDrawer/cashDrawerSlice'
import i18n from '@/i18n'
import { selectAuthToken } from '@/rtk/features/auth/authSlice'
import { toResultError } from '@/api/result'
import { parseMoneyInput } from '@/lib/formatCurrency'

/**
 * Cash drawer session — open, current, expected, close.
 */
export function useCashDrawer({ skipCurrent = false, skipExpected = false } = {}) {
  const dispatch = useAppDispatch()
  const token = useAppSelector(selectAuthToken)
  const currentData = useAppSelector(selectCashDrawerCurrent)
  const expectedData = useAppSelector(selectCashDrawerExpected)
  const loadingCurrent = useAppSelector(selectCashDrawerLoadingCurrent)
  const loadingExpected = useAppSelector(selectCashDrawerLoadingExpected)
  const opening = useAppSelector(selectCashDrawerOpening)
  const closing = useAppSelector(selectCashDrawerClosing)
  const error = useAppSelector(selectCashDrawerError)

  const cashDrawer = currentData?.id ? currentData : null
  const cashDrawerOpen = Boolean(cashDrawer?.id)

  useEffect(() => {
    if (skipCurrent || !token) return
    dispatch(fetchCurrentCashDrawer())
  }, [skipCurrent, token, dispatch])

  useEffect(() => {
    if (skipExpected || !token || !cashDrawerOpen) return
    dispatch(fetchExpectedCashDrawer())
  }, [skipExpected, token, cashDrawerOpen, dispatch])

  const openCashDrawer = useCallback(
    async (floatAmount) => {
      const amount = parseMoneyInput(floatAmount)
      if (Number.isNaN(amount) || amount < 0) {
        return { success: false, error: i18n.t('openCashDrawer.invalidOpeningAmount') }
      }
      try {
        const data = await dispatch(
          openThunk({ openingFloat: amount }),
        ).unwrap()
        await dispatch(fetchCurrentCashDrawer())
        return {
          success: true,
          data: {
            cashDrawer: data.cashDrawer,
            saleTab: data.saleTab,
            openingFloat: data.cashDrawer?.openingFloat ?? amount,
            sessionId: data.cashDrawer?.id || null,
          },
        }
      } catch (err) {
        return toResultError(err)
      }
    },
    [dispatch],
  )

  const closeCashDrawer = useCallback(
    async ({ countedCash, remarks, managerPassword, supervisorPin } = {}) => {
      const amount = parseMoneyInput(countedCash)
      if (Number.isNaN(amount) || amount < 0) {
        return { success: false, error: i18n.t('closeCashDrawer.invalidCounted') }
      }
      try {
        const body = { countedCash: amount }
        if (remarks != null && String(remarks).trim()) {
          body.remarks = String(remarks).trim()
        }
        const password =
          managerPassword != null && String(managerPassword).trim()
            ? String(managerPassword).trim()
            : supervisorPin != null && String(supervisorPin).trim()
              ? String(supervisorPin).trim()
              : null
        if (password) {
          body.managerPassword = password
        }
        const data = await dispatch(closeThunk(body)).unwrap()
        return { success: true, data }
      } catch (err) {
        return toResultError(err)
      }
    },
    [dispatch],
  )

  return {
    cashDrawerOpen,
    cashDrawer,
    openingFloat: cashDrawer?.openingFloat ?? null,
    sessionId: cashDrawer?.id ?? null,
    expected: expectedData || null,
    expectedCash: expectedData?.expectedCash ?? null,
    openCashDrawer,
    closeCashDrawer,
    refetchCurrent: () => dispatch(fetchCurrentCashDrawer()),
    refetchExpected: () => dispatch(fetchExpectedCashDrawer()),
    isCurrentLoading: loadingCurrent,
    isExpectedLoading: loadingExpected,
    isExpectedError: Boolean(error) && !expectedData,
    expectedError: error ? toResultError({ message: error }) : null,
    isOpening: opening,
    isClosing: closing,
  }
}

export default useCashDrawer
