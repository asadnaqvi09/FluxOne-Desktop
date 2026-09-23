import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { ENDPOINTS } from '@/api/endpoints'
import { apiRequest, toThunkError } from '@/api/apiHelper'
import { mapSaleTab, mapSaleTabs, mapSaleTotals } from '@/lib/mapSale'
import { clearCredentials } from '@/rtk/features/auth/authSlice'
import i18n from '@/i18n'

const emptyTotals = mapSaleTotals(null)

const initialState = {
  tabs: [],
  cashDrawerId: null,
  totalsByTabId: {},
  listLoading: false,
  totalsLoading: false,
  mutating: false,
  checkingOut: false,
  error: null,
}

export const fetchSaleTabs = createAsyncThunk(
  'sales/fetchTabs',
  async (_, { rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.sales.tabs, { method: 'GET' })
      return {
        tabs: mapSaleTabs(data?.tabs || []),
        cashDrawerId: data?.cashDrawerId || null,
      }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const createSaleTab = createAsyncThunk(
  'sales/createTab',
  async (_, { rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.sales.tabs, { method: 'POST' })
      return { tab: mapSaleTab(data?.tab) }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const deleteSaleTab = createAsyncThunk(
  'sales/deleteTab',
  async (tabId, { rejectWithValue }) => {
    try {
      await apiRequest(ENDPOINTS.sales.tab(tabId), { method: 'DELETE' })
      return { tabId }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const addSaleItem = createAsyncThunk(
  'sales/addItem',
  async ({ tabId, ...body }, { dispatch, rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.sales.addItem(tabId), {
        method: 'POST',
        body,
      })
      await dispatch(fetchSaleTabs())
      await dispatch(fetchSaleTotals(tabId))
      return {
        tabId,
        item: data?.item || null,
        stock: data?.stock ?? null,
        lowStock: Boolean(data?.lowStock),
        warning: data?.warning || null,
      }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const updateSaleItem = createAsyncThunk(
  'sales/updateItem',
  async ({ tabId, lineId, qty }, { dispatch, rejectWithValue }) => {
    try {
      await apiRequest(ENDPOINTS.sales.item(tabId, lineId), {
        method: 'PATCH',
        body: { qty },
      })
      await dispatch(fetchSaleTabs())
      await dispatch(fetchSaleTotals(tabId))
      return { tabId, lineId, qty }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const removeSaleItem = createAsyncThunk(
  'sales/removeItem',
  async ({ tabId, lineId }, { dispatch, rejectWithValue }) => {
    try {
      await apiRequest(ENDPOINTS.sales.item(tabId, lineId), {
        method: 'DELETE',
      })
      await dispatch(fetchSaleTabs())
      await dispatch(fetchSaleTotals(tabId))
      return { tabId, lineId }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const fetchSaleTotals = createAsyncThunk(
  'sales/fetchTotals',
  async (tabId, { rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.sales.totals(tabId), {
        method: 'GET',
      })
      return { tabId, totals: mapSaleTotals(data) }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const checkoutSale = createAsyncThunk(
  'sales/checkout',
  async ({ tabId, tendered }, { dispatch, rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.sales.checkout(tabId), {
        method: 'POST',
        body: { tendered },
      })
      await dispatch(fetchSaleTabs())
      return {
        ...data,
        newTab: data?.newTab ? mapSaleTab(data.newTab) : null,
      }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

const salesSlice = createSlice({
  name: 'sales',
  initialState,
  reducers: {
    resetSales() {
      return { ...initialState }
    },
    clearSalesError(state) {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(clearCredentials, () => ({ ...initialState }))
      .addCase(fetchSaleTabs.pending, (state) => {
        state.listLoading = true
        state.error = null
      })
      .addCase(fetchSaleTabs.fulfilled, (state, action) => {
        state.listLoading = false
        state.tabs = action.payload.tabs
        state.cashDrawerId = action.payload.cashDrawerId
      })
      .addCase(fetchSaleTabs.rejected, (state, action) => {
        state.listLoading = false
        state.error =
          action.payload?.message || i18n.t('errors.loadSaleTabs')
      })
      .addCase(createSaleTab.pending, (state) => {
        state.mutating = true
        state.error = null
      })
      .addCase(createSaleTab.fulfilled, (state) => {
        state.mutating = false
      })
      .addCase(createSaleTab.rejected, (state, action) => {
        state.mutating = false
        state.error =
          action.payload?.message || i18n.t('errors.createTab')
      })
      .addCase(deleteSaleTab.pending, (state) => {
        state.mutating = true
        state.error = null
      })
      .addCase(deleteSaleTab.fulfilled, (state, action) => {
        state.mutating = false
        state.tabs = mapSaleTabs(
          state.tabs.filter((t) => t.id !== action.payload.tabId),
        )
        delete state.totalsByTabId[action.payload.tabId]
      })
      .addCase(deleteSaleTab.rejected, (state, action) => {
        state.mutating = false
        state.error =
          action.payload?.message || i18n.t('errors.deleteTab')
      })
      .addCase(addSaleItem.pending, (state) => {
        state.mutating = true
      })
      .addCase(addSaleItem.fulfilled, (state) => {
        state.mutating = false
      })
      .addCase(addSaleItem.rejected, (state, action) => {
        state.mutating = false
        state.error =
          action.payload?.message || i18n.t('errors.addItem')
      })
      .addCase(updateSaleItem.pending, (state) => {
        state.mutating = true
      })
      .addCase(updateSaleItem.fulfilled, (state) => {
        state.mutating = false
      })
      .addCase(updateSaleItem.rejected, (state, action) => {
        state.mutating = false
        state.error =
          action.payload?.message || i18n.t('errors.updateItem')
      })
      .addCase(removeSaleItem.pending, (state) => {
        state.mutating = true
      })
      .addCase(removeSaleItem.fulfilled, (state) => {
        state.mutating = false
      })
      .addCase(removeSaleItem.rejected, (state, action) => {
        state.mutating = false
        state.error =
          action.payload?.message || i18n.t('errors.removeItem')
      })
      .addCase(fetchSaleTotals.pending, (state) => {
        state.totalsLoading = true
      })
      .addCase(fetchSaleTotals.fulfilled, (state, action) => {
        state.totalsLoading = false
        state.totalsByTabId[action.payload.tabId] = action.payload.totals
      })
      .addCase(fetchSaleTotals.rejected, (state, action) => {
        state.totalsLoading = false
        state.error =
          action.payload?.message || i18n.t('errors.loadTotals')
      })
      .addCase(checkoutSale.pending, (state) => {
        state.checkingOut = true
        state.error = null
      })
      .addCase(checkoutSale.fulfilled, (state) => {
        state.checkingOut = false
      })
      .addCase(checkoutSale.rejected, (state, action) => {
        state.checkingOut = false
        state.error = action.payload?.message || 'Checkout failed'
      })
  },
})

export const { resetSales, clearSalesError } = salesSlice.actions

export const selectSaleTabs = (state) => state.sales.tabs
export const selectSalesCashDrawerId = (state) => state.sales.cashDrawerId
export const selectSaleTotalsByTabId = (state) => state.sales.totalsByTabId
export const selectSaleTotals = (tabId) => (state) =>
  state.sales.totalsByTabId[tabId] || emptyTotals
export const selectSalesListLoading = (state) => state.sales.listLoading
export const selectSalesTotalsLoading = (state) => state.sales.totalsLoading
export const selectSalesMutating = (state) => state.sales.mutating
export const selectSalesCheckingOut = (state) => state.sales.checkingOut
export const selectSalesError = (state) => state.sales.error

export default salesSlice.reducer
