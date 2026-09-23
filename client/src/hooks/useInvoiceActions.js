import { useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/rtk/hooks'
import {
  fetchInvoice,
  fetchInvoiceExchanges,
  printInvoice,
  returnInvoice,
  selectInvoiceById,
  selectInvoiceDetailLoading,
  selectInvoiceExchanging,
  selectInvoiceReturning,
  selectInvoicesError,
  startExchange,
} from '@/rtk/features/invoices/invoicesSlice'
import { mapInvoicePrint } from '@/lib/mapInvoice'
import { toResultError } from '@/api/result'
import { usePos } from '@/context/PosContext'
import { useAuth } from '@/context/AuthContext'
import i18n from '@/i18n'

export function useInvoice(invoiceId, { skip = false } = {}) {
  const dispatch = useAppDispatch()
  const invoice = useAppSelector(selectInvoiceById(invoiceId))
  const loading = useAppSelector(selectInvoiceDetailLoading)
  const error = useAppSelector(selectInvoicesError)

  useEffect(() => {
    if (skip || !invoiceId) return
    dispatch(fetchInvoice(invoiceId))
  }, [skip, invoiceId, dispatch])

  return {
    invoice: invoice || null,
    isLoading: loading,
    isError: Boolean(error) && !invoice,
    error: error ? toResultError({ message: error }) : null,
    refetch: () =>
      invoiceId ? dispatch(fetchInvoice(invoiceId)) : undefined,
  }
}

/**
 * Invoice detail + return / exchange / reprint / previous exchanges.
 */
export function useInvoiceActions() {
  const dispatch = useAppDispatch()
  const { user } = useAuth()
  const { setReceiptFromCheckout, setReturnSlip, selectSaleTab } = usePos()
  const returning = useAppSelector(selectInvoiceReturning)
  const exchanging = useAppSelector(selectInvoiceExchanging)

  const loadInvoice = useCallback(
    async (invoiceId) => {
      if (!invoiceId) {
        return { success: false, error: i18n.t('invoices.invoiceIdRequired') }
      }
      try {
        const data = await dispatch(fetchInvoice(invoiceId)).unwrap()
        if (!data?.invoice) {
          return { success: false, error: i18n.t('invoices.detailNotFound') }
        }
        return { success: true, data: data.invoice }
      } catch (err) {
        return toResultError(err)
      }
    },
    [dispatch],
  )

  const reprint = useCallback(
    async (invoiceId) => {
      if (!invoiceId) {
        return { success: false, error: i18n.t('invoices.invoiceIdRequired') }
      }
      try {
        const data = await dispatch(printInvoice(invoiceId)).unwrap()
        const base =
          data?.receipt ||
          mapInvoicePrint(data?.raw || data, {
            cashierName: user?.name,
            cashierId: user?.employeeId || user?.userId,
          })
        const receipt = {
          ...base,
          cashier: user?.name || base.cashier || i18n.t('receipt.cashierFallback'),
          cashierId:
            user?.employeeId || user?.id || user?.userId || base.cashierId || '',
          store: base.store ? { ...base.store } : null,
        }
        setReceiptFromCheckout?.(receipt)
        return { success: true, data: receipt }
      } catch (err) {
        return toResultError(err)
      }
    },
    [dispatch, user, setReceiptFromCheckout],
  )

  const processReturn = useCallback(
    async (invoiceId, itemIds) => {
      const ids = [...new Set((itemIds || []).filter(Boolean))]
      if (!invoiceId) {
        return { success: false, error: i18n.t('invoices.invoiceIdRequired') }
      }
      if (!ids.length) {
        return { success: false, error: i18n.t('invoices.selectAtLeastOneItem') }
      }
      try {
        const data = await dispatch(
          returnInvoice({ invoiceId, itemIds: ids }),
        ).unwrap()
        if (data?.slip) setReturnSlip?.(data.slip)
        return {
          success: true,
          data: data?.slip,
          refundAmount: data?.refundAmount,
        }
      } catch (err) {
        return toResultError(err)
      }
    },
    [dispatch, setReturnSlip],
  )

  const startExchangeAction = useCallback(
    async (invoiceId, itemIds) => {
      const ids = [...new Set((itemIds || []).filter(Boolean))]
      if (!invoiceId) {
        return { success: false, error: i18n.t('invoices.invoiceIdRequired') }
      }
      if (!ids.length) {
        return {
          success: false,
          error: i18n.t('invoices.selectAtLeastOneToExchange'),
        }
      }
      try {
        const data = await dispatch(
          startExchange({ invoiceId, itemIds: ids }),
        ).unwrap()
        if (data?.tab?.id) selectSaleTab(data.tab.id)
        return { success: true, data }
      } catch (err) {
        return toResultError(err)
      }
    },
    [dispatch, selectSaleTab],
  )

  const loadExchanges = useCallback(
    async (invoiceId) => {
      if (!invoiceId) {
        return { success: false, error: i18n.t('invoices.invoiceIdRequired') }
      }
      try {
        const data = await dispatch(fetchInvoiceExchanges(invoiceId)).unwrap()
        return {
          success: true,
          data: {
            invoiceId: data.invoiceId,
            events: data.events || [],
          },
        }
      } catch (err) {
        return toResultError(err)
      }
    },
    [dispatch],
  )

  return {
    loadInvoice,
    reprint,
    processReturn,
    startExchange: startExchangeAction,
    loadExchanges,
    isReturning: returning,
    isStartingExchange: exchanging,
  }
}

export default useInvoiceActions
