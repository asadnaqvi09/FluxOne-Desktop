import { useEffect, useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '@/rtk/hooks'
import {
  fetchInvoices,
  selectInvoiceList,
  selectInvoicesError,
  selectInvoicesListLoading,
} from '@/rtk/features/invoices/invoicesSlice'
import { selectAuthToken } from '@/rtk/features/auth/authSlice'
import {
  buildInvoiceListParams,
  invoiceStatsFromList,
} from '@/lib/mapInvoice'
import { toResultError } from '@/api/result'
import { INVOICE_PAGE_SIZE } from '@/data/invoices'

/**
 * Invoice list — server filters date/time/q; type filter is client-side.
 */
export function useInvoices({
  q = '',
  day = '',
  hourFrom = '',
  hourTo = '',
  type = '',
  page = 1,
  pageSize = INVOICE_PAGE_SIZE,
  skip = false,
} = {}) {
  const dispatch = useAppDispatch()
  const token = useAppSelector(selectAuthToken)
  const list = useAppSelector(selectInvoiceList)
  const listLoading = useAppSelector(selectInvoicesListLoading)
  const error = useAppSelector(selectInvoicesError)

  const params = useMemo(
    () => buildInvoiceListParams({ q, day, hourFrom, hourTo }),
    [q, day, hourFrom, hourTo],
  )

  useEffect(() => {
    if (skip || !token) return
    dispatch(fetchInvoices(params))
  }, [skip, token, params, dispatch])

  const filtered = useMemo(() => {
    if (!type) return list
    return list.filter((i) => (i.type || 'Sale') === type)
  }, [list, type])

  const stats = useMemo(() => invoiceStatsFromList(filtered), [filtered])

  const pageCount = Math.max(1, Math.ceil(filtered.length / (pageSize || 1)) || 1)
  const safePage = Math.min(page, pageCount)
  const slice = useMemo(
    () =>
      filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize],
  )

  return {
    invoices: slice,
    allInvoices: filtered,
    total: filtered.length,
    page: safePage,
    pageCount,
    pageSize,
    stats,
    isLoading: listLoading,
    isError: Boolean(error),
    error: error ? toResultError({ message: error }) : null,
    refetch: () => dispatch(fetchInvoices(params)),
  }
}

export default useInvoices
