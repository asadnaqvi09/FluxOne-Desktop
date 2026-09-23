import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import { CATALOG_PAGE_SIZE } from '@/data/products'

const PosContext = createContext(null)

/**
 * POS UI state — catalog filters, receipt / return-slip modals, active tab id.
 * Tabs/cart/checkout → sales hooks; invoices → invoice hooks.
 */
export function PosProvider({ children }) {
  const [activeTabId, setActiveTabId] = useState(null)
  const [categoryId, setCategoryId] = useState('all')
  const [subCategory, setSubCategory] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [receiptInvoice, setReceiptInvoice] = useState(null)
  const [returnSlip, setReturnSlip] = useState(null)
  /** Invoice detail for editing given lines while already in exchange mode */
  const [exchangePicker, setExchangePicker] = useState(null)

  const selectSaleTab = useCallback((id) => {
    setActiveTabId(id)
  }, [])

  const selectCategory = useCallback((id) => {
    setCategoryId(id)
    setSubCategory('')
    setSearchQuery('')
    setPage(1)
  }, [])

  const selectSubCategory = useCallback((sub) => {
    setSubCategory(sub)
    setPage(1)
  }, [])

  const clearSubCategory = useCallback(() => {
    setSubCategory('')
    setPage(1)
  }, [])

  const setSearch = useCallback((q) => {
    setSearchQuery(q)
    setPage(1)
  }, [])

  const setReceiptFromCheckout = useCallback((invoice) => {
    setReceiptInvoice(invoice || null)
  }, [])

  const closeReceipt = useCallback(() => {
    setReceiptInvoice(null)
  }, [])

  const closeReturnSlip = useCallback(() => {
    setReturnSlip(null)
  }, [])

  const openReprint = useCallback((invoice) => {
    if (invoice) setReceiptInvoice(invoice)
  }, [])

  const openExchangePicker = useCallback((invoice) => {
    setExchangePicker(invoice || null)
  }, [])

  const closeExchangePicker = useCallback(() => {
    setExchangePicker(null)
  }, [])

  const value = useMemo(
    () => ({
      activeTabId,
      selectSaleTab,
      categoryId,
      subCategory,
      searchQuery,
      page,
      pageSize: CATALOG_PAGE_SIZE,
      setPage,
      receiptInvoice,
      returnSlip,
      setReturnSlip,
      exchangePicker,
      openExchangePicker,
      closeExchangePicker,
      selectCategory,
      selectSubCategory,
      clearSubCategory,
      setSearch,
      closeReceipt,
      closeReturnSlip,
      openReprint,
      setReceiptFromCheckout,
    }),
    [
      activeTabId,
      selectSaleTab,
      categoryId,
      subCategory,
      searchQuery,
      page,
      receiptInvoice,
      returnSlip,
      exchangePicker,
      openExchangePicker,
      closeExchangePicker,
      selectCategory,
      selectSubCategory,
      clearSubCategory,
      setSearch,
      closeReceipt,
      closeReturnSlip,
      openReprint,
      setReceiptFromCheckout,
    ],
  )

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- paired provider + hook
export function usePos() {
  const ctx = useContext(PosContext)
  if (!ctx) throw new Error('usePos must be used within PosProvider')
  return ctx
}
