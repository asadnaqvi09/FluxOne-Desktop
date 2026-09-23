import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { ENDPOINTS } from '@/api/endpoints'
import { apiRequest, toThunkError } from '@/api/apiHelper'
import i18n from '@/i18n'
import {
  mapExchangeEvents,
  mapInvoiceDetail,
  mapInvoiceListRow,
  mapInvoicePrint,
  mapReturnSlip,
} from '@/lib/mapInvoice'
import { mapSaleTab } from '@/lib/mapSale'
import { clearCredentials } from '@/rtk/features/auth/authSlice'
import { fetchSaleTabs } from '@/rtk/features/sales/salesSlice'
import { fetchNotifications } from '@/rtk/features/notifications/notificationsSlice'
import { invalidateProducts } from '@/rtk/features/catalog/catalogSlice'

const initialState = {
  list: [],
  count: 0,
  listParamsKey: '',
  byId: {},
  exchangesByInvoiceId: {},
  listLoading: false,
  detailLoading: false,
  returning: false,
  exchanging: false,
  error: null,
}

function paramsKey(params = {}) {
  return JSON.stringify(params || {})
}

export const fetchInvoices = createAsyncThunk(
  'invoices/fetchList',
  async (params = {}, { rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.invoices.list, {
        method: 'GET',
        params,
      })
      return {
        invoices: (data?.invoices || []).map(mapInvoiceListRow).filter(Boolean),
        count: data?.count ?? 0,
        paramsKey: paramsKey(params),
      }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const fetchInvoice = createAsyncThunk(
  'invoices/fetchOne',
  async (invoiceId, { rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.invoices.byId(invoiceId), {
        method: 'GET',
      })
      return {
        invoiceId,
        invoice: mapInvoiceDetail(data),
      }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const printInvoice = createAsyncThunk(
  'invoices/print',
  async (invoiceId, { rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.invoices.print(invoiceId), {
        method: 'GET',
      })
      return {
        receipt: mapInvoicePrint(data),
        raw: data,
      }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const returnInvoice = createAsyncThunk(
  'invoices/return',
  async ({ invoiceId, itemIds }, { dispatch, getState, rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.invoices.return(invoiceId), {
        method: 'POST',
        body: { itemIds },
      })
      await dispatch(fetchInvoice(invoiceId))

      // Stay on Invoices tab: refresh the table + stats without a remount.
      let listParams = {}
      try {
        const key = getState().invoices.listParamsKey
        if (key) listParams = JSON.parse(key)
      } catch {
        listParams = {}
      }
      await dispatch(fetchInvoices(listParams))
      await dispatch(fetchNotifications())
      dispatch(invalidateProducts())

      return {
        slip: mapReturnSlip(data),
        refundAmount: Number(data?.refundAmount) || 0,
        raw: data,
        invoiceId,
      }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const startExchange = createAsyncThunk(
  'invoices/startExchange',
  async ({ invoiceId, itemIds }, { dispatch, rejectWithValue }) => {
    try {
      const data = await apiRequest(
        ENDPOINTS.invoices.exchangeStart(invoiceId),
        {
          method: 'POST',
          body: { itemIds },
        },
      )
      await dispatch(fetchSaleTabs())
      return {
        tab: data?.tab ? mapSaleTab(data.tab) : null,
        invoiceId: data?.invoiceId || invoiceId,
        exchangedCredit: Number(data?.exchangedCredit) || 0,
        given: data?.given || [],
      }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const fetchInvoiceExchanges = createAsyncThunk(
  'invoices/fetchExchanges',
  async (invoiceId, { rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.invoices.exchanges(invoiceId), {
        method: 'GET',
      })
      return {
        invoiceId: data?.invoiceId || invoiceId,
        events: mapExchangeEvents(data?.events || []),
      }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

const invoicesSlice = createSlice({
  name: 'invoices',
  initialState,
  reducers: {
    resetInvoices() {
      return { ...initialState }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(clearCredentials, () => ({ ...initialState }))
      .addCase(fetchInvoices.pending, (state) => {
        state.listLoading = true
        state.error = null
      })
      .addCase(fetchInvoices.fulfilled, (state, action) => {
        state.listLoading = false
        state.list = action.payload.invoices
        state.count = action.payload.count
        state.listParamsKey = action.payload.paramsKey
      })
      .addCase(fetchInvoices.rejected, (state, action) => {
        state.listLoading = false
        state.error =
          action.payload?.message || i18n.t('errors.loadInvoices')
      })
      .addCase(fetchInvoice.pending, (state) => {
        state.detailLoading = true
        state.error = null
      })
      .addCase(fetchInvoice.fulfilled, (state, action) => {
        state.detailLoading = false
        if (action.payload.invoice) {
          state.byId[action.payload.invoiceId] = action.payload.invoice
        }
      })
      .addCase(fetchInvoice.rejected, (state, action) => {
        state.detailLoading = false
        state.error =
          action.payload?.message || i18n.t('errors.loadInvoice')
      })
      .addCase(returnInvoice.pending, (state) => {
        state.returning = true
      })
      .addCase(returnInvoice.fulfilled, (state) => {
        state.returning = false
      })
      .addCase(returnInvoice.rejected, (state, action) => {
        state.returning = false
        state.error = action.payload?.message || 'Return failed'
      })
      .addCase(startExchange.pending, (state) => {
        state.exchanging = true
      })
      .addCase(startExchange.fulfilled, (state) => {
        state.exchanging = false
      })
      .addCase(startExchange.rejected, (state, action) => {
        state.exchanging = false
        state.error = action.payload?.message || 'Exchange start failed'
      })
      .addCase(fetchInvoiceExchanges.fulfilled, (state, action) => {
        state.exchangesByInvoiceId[action.payload.invoiceId] =
          action.payload.events
      })
  },
})

export const { resetInvoices } = invoicesSlice.actions

export const selectInvoiceList = (state) => state.invoices.list
export const selectInvoiceById = (id) => (state) => state.invoices.byId[id]
export const selectInvoicesListLoading = (state) => state.invoices.listLoading
export const selectInvoiceDetailLoading = (state) =>
  state.invoices.detailLoading
export const selectInvoiceReturning = (state) => state.invoices.returning
export const selectInvoiceExchanging = (state) => state.invoices.exchanging
export const selectInvoicesError = (state) => state.invoices.error

export default invoicesSlice.reducer
