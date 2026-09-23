import { useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/rtk/hooks'
import {
  checkoutSale,
  fetchSaleTotals,
  selectSaleTotals,
  selectSalesCheckingOut,
  selectSalesError,
  selectSalesTotalsLoading,
} from '@/rtk/features/sales/salesSlice'
import { invalidateProducts } from '@/rtk/features/catalog/catalogSlice'
import { selectAuthCashDrawerOpen } from '@/rtk/features/auth/authSlice'
import { mapCheckoutReceipt } from '@/lib/mapSale'
import { toResultError } from '@/api/result'
import { useSaleTabs } from '@/hooks/useSaleTabs'
import { usePos } from '@/context/PosContext'
import { useAuth } from '@/context/AuthContext'
import { parseMoneyInput, roundMoney } from '@/lib/formatCurrency'
import i18n from '@/i18n'

/**
 * Bill totals + cash checkout.
 */
export function useCheckout() {
  const dispatch = useAppDispatch()
  const cashDrawerOpenStore = useAppSelector(selectAuthCashDrawerOpen)
  const { user, cashDrawerOpen: cashDrawerOpenAuth } = useAuth()
  const cashDrawerOpen = cashDrawerOpenStore || cashDrawerOpenAuth
  const { activeTabId, activeTab, selectSaleTab } = useSaleTabs()
  const { setReceiptFromCheckout } = usePos()

  const totals = useAppSelector(selectSaleTotals(activeTabId))
  const totalsLoading = useAppSelector(selectSalesTotalsLoading)
  const checkingOut = useAppSelector(selectSalesCheckingOut)
  const salesError = useAppSelector(selectSalesError)

  useEffect(() => {
    if (!cashDrawerOpen || !activeTabId) return
    dispatch(fetchSaleTotals(activeTabId))
  }, [cashDrawerOpen, activeTabId, dispatch])

  const exchangeCredit = roundMoney(Number(totals?.exchangedCredit) || 0)
  const isExchange = activeTab?.exchangeMode || totals?.mode === 'exchange'
  const payTotal = roundMoney(
    isExchange ? Number(totals?.netDue) || 0 : Number(totals?.total) || 0,
  )

  const checkout = useCallback(
    async ({ tendered } = {}) => {
      if (!cashDrawerOpen) {
        return { success: false, error: i18n.t('cashPay.cashDrawerMustBeOpen') }
      }
      if (!activeTabId) {
        return { success: false, error: i18n.t('cashPay.noActiveSaleTab') }
      }
      const parsed = parseMoneyInput(tendered)
      if (Number.isNaN(parsed) || parsed < 0) {
        return { success: false, error: i18n.t('cashPay.invalidTendered') }
      }
      const amount = roundMoney(parsed)

      try {
        const data = await dispatch(
          checkoutSale({ tabId: activeTabId, tendered: amount }),
        ).unwrap()

        const receipt = mapCheckoutReceipt(data, {
          cashierName: user?.name,
          cashierId: user?.employeeId || user?.userId,
        })

        setReceiptFromCheckout?.(receipt)

        if (data?.newTab?.id) {
          selectSaleTab(data.newTab.id)
        }

        dispatch(invalidateProducts())

        return { success: true, data: receipt, raw: data }
      } catch (err) {
        return toResultError(err)
      }
    },
    [
      cashDrawerOpen,
      activeTabId,
      dispatch,
      user,
      setReceiptFromCheckout,
      selectSaleTab,
      dispatch,
    ],
  )

  return {
    totals: totals || {
      actual: 0,
      after: 0,
      tax1: 0,
      tax2: 0,
      tax: 0,
      total: 0,
      taxes: [],
      active: [],
      subtotal: 0,
    },
    payTotal,
    exchangeCredit,
    isExchange: Boolean(isExchange),
    checkout,
    refetchTotals: () =>
      activeTabId ? dispatch(fetchSaleTotals(activeTabId)) : undefined,
    isTotalsLoading: totalsLoading,
    isTotalsError: Boolean(salesError),
    totalsError: salesError ? toResultError({ message: salesError }) : null,
    isCheckingOut: checkingOut,
  }
}

export default useCheckout
