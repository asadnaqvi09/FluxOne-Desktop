import { useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/rtk/hooks'
import {
  createSaleTab,
  deleteSaleTab,
  fetchSaleTabs,
  selectSaleTabs,
  selectSalesListLoading,
  selectSalesMutating,
  selectSalesError,
} from '@/rtk/features/sales/salesSlice'
import {
  selectAuthCashDrawerOpen,
  selectAuthToken,
} from '@/rtk/features/auth/authSlice'
import { toResultError } from '@/api/result'
import { usePos } from '@/context/PosContext'
import { useAuth } from '@/context/AuthContext'
import i18n from '@/i18n'

/**
 * Server sale tabs — list / create / delete / select.
 */
export function useSaleTabs({ skip = false } = {}) {
  const dispatch = useAppDispatch()
  const token = useAppSelector(selectAuthToken)
  const cashDrawerOpenStore = useAppSelector(selectAuthCashDrawerOpen)
  const { cashDrawerOpen: cashDrawerOpenAuth } = useAuth()
  const cashDrawerOpen = cashDrawerOpenStore || cashDrawerOpenAuth
  const { activeTabId, selectSaleTab } = usePos()

  const tabs = useAppSelector(selectSaleTabs)
  const listLoading = useAppSelector(selectSalesListLoading)
  const mutating = useAppSelector(selectSalesMutating)
  const error = useAppSelector(selectSalesError)

  const canLoad = !skip && Boolean(token) && cashDrawerOpen

  useEffect(() => {
    if (!canLoad) return
    dispatch(fetchSaleTabs())
  }, [canLoad, dispatch])

  const resolvedActiveId =
    (activeTabId && tabs.some((t) => t.id === activeTabId) && activeTabId) ||
    tabs[0]?.id ||
    null
  const activeTab = tabs.find((t) => t.id === resolvedActiveId) || tabs[0] || null

  useEffect(() => {
    if (!tabs.length) return
    if (!activeTabId || !tabs.some((t) => t.id === activeTabId)) {
      selectSaleTab(tabs[0].id)
    }
  }, [tabs, activeTabId, selectSaleTab])

  const addSaleTab = useCallback(async () => {
    try {
      const result = await dispatch(createSaleTab()).unwrap()
      if (result?.tab?.id) selectSaleTab(result.tab.id)
      await dispatch(fetchSaleTabs())
      return { success: true, data: result }
    } catch (err) {
      return toResultError(err)
    }
  }, [dispatch, selectSaleTab])

  const closeSaleTab = useCallback(
    async (id) => {
      if (tabs.length <= 1) {
        return { success: false, error: i18n.t('saleTabs.atLeastOneTab') }
      }
      try {
        await dispatch(deleteSaleTab(id)).unwrap()
        if (id === resolvedActiveId) {
          const next = tabs.find((t) => t.id !== id)
          if (next) selectSaleTab(next.id)
        }
        return { success: true }
      } catch (err) {
        return toResultError(err)
      }
    },
    [dispatch, tabs, resolvedActiveId, selectSaleTab],
  )

  const cancelExchange = useCallback(async () => {
    const tab = activeTab
    if (!tab?.exchangeMode || !tab.id) {
      return { success: false, error: i18n.t('saleTabs.notInExchangeMode') }
    }
    try {
      if (tabs.length <= 1) {
        const created = await dispatch(createSaleTab()).unwrap()
        if (created?.tab?.id) selectSaleTab(created.tab.id)
        await dispatch(deleteSaleTab(tab.id)).unwrap()
      } else {
        await dispatch(deleteSaleTab(tab.id)).unwrap()
        const next = tabs.find((t) => t.id !== tab.id)
        if (next) selectSaleTab(next.id)
      }
      await dispatch(fetchSaleTabs())
      return { success: true }
    } catch (err) {
      return toResultError(err)
    }
  }, [activeTab, tabs, dispatch, selectSaleTab])

  const refetch = useCallback(() => dispatch(fetchSaleTabs()), [dispatch])

  return {
    tabs,
    activeTab,
    activeTabId: resolvedActiveId,
    addSaleTab,
    selectSaleTab,
    closeSaleTab,
    cancelExchange,
    refetch,
    isLoading: listLoading,
    isError: Boolean(error),
    error: error ? toResultError({ message: error }) : null,
    isCreating: mutating,
    isDeleting: mutating,
  }
}

export default useSaleTabs
