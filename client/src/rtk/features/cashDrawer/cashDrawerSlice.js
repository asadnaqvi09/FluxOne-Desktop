import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { ENDPOINTS } from '@/api/endpoints'
import { apiRequest, toThunkError } from '@/api/apiHelper'
import i18n from '@/i18n'
import {
  clearCredentials,
  setCashDrawerOpen,
} from '@/rtk/features/auth/authSlice'
import { fetchSaleTabs } from '@/rtk/features/sales/salesSlice'

const initialState = {
  current: null,
  expected: null,
  loadingCurrent: false,
  loadingExpected: false,
  opening: false,
  closing: false,
  error: null,
}

/** API sends `{ cashDrawer: null }` when closed. Only a row with an id is open. */
function readOpenDrawer(payload) {
  const drawer = payload?.cashDrawer !== undefined ? payload.cashDrawer : payload
  if (!drawer || typeof drawer !== 'object' || !drawer.id) return null
  return drawer
}

export const openCashDrawer = createAsyncThunk(
  'cashDrawer/open',
  async (body, { dispatch, rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.cashDrawer.open, {
        method: 'POST',
        body,
      })
      dispatch(setCashDrawerOpen(true))
      await dispatch(fetchSaleTabs())
      return data
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const fetchCurrentCashDrawer = createAsyncThunk(
  'cashDrawer/fetchCurrent',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.cashDrawer.current, { method: 'GET' })
      const drawer = readOpenDrawer(data)
      dispatch(setCashDrawerOpen(Boolean(drawer)))
      return data
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const fetchExpectedCashDrawer = createAsyncThunk(
  'cashDrawer/fetchExpected',
  async (_, { rejectWithValue }) => {
    try {
      return await apiRequest(ENDPOINTS.cashDrawer.expected, { method: 'GET' })
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const closeCashDrawer = createAsyncThunk(
  'cashDrawer/close',
  async (body, { dispatch, rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.cashDrawer.close, {
        method: 'POST',
        body,
      })
      dispatch(setCashDrawerOpen(false))
      return data
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

const cashDrawerSlice = createSlice({
  name: 'cashDrawer',
  initialState,
  reducers: {
    resetCashDrawer() {
      return { ...initialState }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(clearCredentials, () => ({ ...initialState }))
      .addCase(openCashDrawer.pending, (state) => {
        state.opening = true
        state.error = null
      })
      .addCase(openCashDrawer.fulfilled, (state, action) => {
        state.opening = false
        state.current = readOpenDrawer(action.payload)
      })
      .addCase(openCashDrawer.rejected, (state, action) => {
        state.opening = false
        state.error =
          action.payload?.message || i18n.t('errors.openCashDrawer')
      })
      .addCase(fetchCurrentCashDrawer.pending, (state) => {
        state.loadingCurrent = true
      })
      .addCase(fetchCurrentCashDrawer.fulfilled, (state, action) => {
        state.loadingCurrent = false
        state.current = readOpenDrawer(action.payload)
      })
      .addCase(fetchCurrentCashDrawer.rejected, (state, action) => {
        state.loadingCurrent = false
        state.error =
          action.payload?.message || i18n.t('errors.loadCashDrawer')
      })
      .addCase(fetchExpectedCashDrawer.pending, (state) => {
        state.loadingExpected = true
      })
      .addCase(fetchExpectedCashDrawer.fulfilled, (state, action) => {
        state.loadingExpected = false
        state.expected = action.payload
      })
      .addCase(fetchExpectedCashDrawer.rejected, (state, action) => {
        state.loadingExpected = false
        state.error =
          action.payload?.message || i18n.t('errors.loadExpectedCash')
      })
      .addCase(closeCashDrawer.pending, (state) => {
        state.closing = true
        state.error = null
      })
      .addCase(closeCashDrawer.fulfilled, (state) => {
        state.closing = false
        state.current = null
        state.expected = null
      })
      .addCase(closeCashDrawer.rejected, (state, action) => {
        state.closing = false
        state.error =
          action.payload?.message || i18n.t('errors.closeCashDrawer')
      })
  },
})

export const { resetCashDrawer } = cashDrawerSlice.actions

export const selectCashDrawerCurrent = (state) => state.cashDrawer.current
export const selectCashDrawerExpected = (state) => state.cashDrawer.expected
export const selectCashDrawerLoadingCurrent = (state) =>
  state.cashDrawer.loadingCurrent
export const selectCashDrawerLoadingExpected = (state) =>
  state.cashDrawer.loadingExpected
export const selectCashDrawerOpening = (state) => state.cashDrawer.opening
export const selectCashDrawerClosing = (state) => state.cashDrawer.closing
export const selectCashDrawerError = (state) => state.cashDrawer.error

export default cashDrawerSlice.reducer
