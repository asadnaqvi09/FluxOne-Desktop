import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { ENDPOINTS } from '@/api/endpoints'
import { apiRequest, toThunkError } from '@/api/apiHelper'
import { toAppTimeIso } from '@/api/result'
import i18n from '@/i18n'
import { clearCredentials, patchSession, loginUser, logoutUser } from '@/rtk/features/auth/authSlice'
import { fetchCategories, invalidateProducts } from '@/rtk/features/catalog/catalogSlice'

const EMPTY_PENDING_BY_TYPE = {
  sale: 0,
  refund: 0,
  cashier_log: 0,
  attendance: 0,
  product_price_update: 0,
}

function mapPendingByType(raw) {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_PENDING_BY_TYPE }
  return {
    ...EMPTY_PENDING_BY_TYPE,
    ...Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [key, Number(value) || 0]),
    ),
  }
}

function mapFailedEvents(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((row) => ({
    clientEventId: row.clientEventId || row.client_event_id || '',
    eventType: row.eventType || row.event_type || 'unknown',
    invoiceId: row.invoiceId || row.invoice_id || null,
    saleNumber: row.saleNumber || row.sale_number || row.invoiceId || null,
    retryCount: Number(row.retryCount ?? row.retry_count) || 0,
    lastError: row.lastError || row.last_error || 'Unknown error',
    createdAt: row.createdAt || row.created_at || null,
  }))
}

function mapStatusPayload(data) {
  if (!data) return {}
  return {
    syncOk: Boolean(data.syncOk),
    sessionSyncOk: Boolean(data.sessionSyncOk),
    bootstrapDone: Boolean(
      data.bootstrapDone ?? data.meta?.bootstrapDone,
    ),
    cloudConfigured: Boolean(data.cloudConfigured),
    online: Boolean(data.online),
    pendingOutbox: Number(data.pendingOutbox) || 0,
    failedOutbox: Number(data.failedOutbox) || 0,
    pendingByType: mapPendingByType(data.pendingByType),
    // DEV: remove failedEvents mapping before client delivery
    failedEvents: mapFailedEvents(data.failedEvents),
    lastPullAt: data.lastPullAt ?? data.meta?.lastPullAt ?? null,
    lastPushAt: data.lastPushAt ?? data.meta?.lastPushAt ?? null,
    meta: data.meta ?? null,
    counts: data.counts ?? null,
  }
}

const initialState = {
  loading: false,
  statusLoading: false,
  error: null,
  lastResult: null,
  syncOk: false,
  sessionSyncOk: false,
  bootstrapDone: false,
  cloudConfigured: false,
  online: true,
  pendingOutbox: 0,
  failedOutbox: 0,
  pendingByType: { ...EMPTY_PENDING_BY_TYPE },
  failedEvents: [],
  lastPullAt: null,
  lastPushAt: null,
  meta: null,
  counts: null,
  statusFetchedAt: null,
}

export const fetchSyncStatus = createAsyncThunk(
  'sync/status',
  async (_, { rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.syncStatus, { method: 'GET' })
      return mapStatusPayload(data)
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const syncCatalog = createAsyncThunk(
  'sync/catalog',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.sync, { method: 'POST' })
      const syncOk = data?.syncOk !== false
      const lastSyncedAt = toAppTimeIso(data?.lastSyncedAt)
      dispatch(patchSession({ syncOk, lastSyncedAt }))
      await dispatch(fetchCategories())
      dispatch(invalidateProducts())
      return {
        ...data,
        lastSyncedAt,
        // POST /sync.syncOk is the session flag; status GET uses syncOk for device ready
        ...mapStatusPayload({
          ...data,
          syncOk: true,
          sessionSyncOk: syncOk,
        }),
      }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    resetSync() {
      return { ...initialState }
    },
    patchSyncStatus(state, action) {
      Object.assign(state, mapStatusPayload(action.payload))
      state.statusFetchedAt = Date.now()
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(clearCredentials, () => ({ ...initialState }))
      .addCase(logoutUser.fulfilled, () => ({ ...initialState }))
      .addCase(loginUser.fulfilled, (state) => {
        // New auth session always starts unsynced — clear prior session sync flags
        state.sessionSyncOk = false
        state.lastResult = null
      })
      .addCase(fetchSyncStatus.pending, (state) => {
        state.statusLoading = true
      })
      .addCase(fetchSyncStatus.fulfilled, (state, action) => {
        state.statusLoading = false
        Object.assign(state, action.payload)
        state.statusFetchedAt = Date.now()
      })
      .addCase(fetchSyncStatus.rejected, (state, action) => {
        state.statusLoading = false
        state.error =
          action.payload?.message || i18n.t('errors.loadSyncStatus')
      })
      .addCase(syncCatalog.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(syncCatalog.fulfilled, (state, action) => {
        state.loading = false
        state.lastResult = action.payload
        Object.assign(state, mapStatusPayload(action.payload))
        state.statusFetchedAt = Date.now()
      })
      .addCase(syncCatalog.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload?.message || 'Sync failed'
      })
  },
})

export const { resetSync, patchSyncStatus } = syncSlice.actions

export const selectSyncLoading = (state) => state.sync.loading
export const selectSyncStatusLoading = (state) => state.sync.statusLoading
export const selectSyncError = (state) => state.sync.error
export const selectSyncLastResult = (state) => state.sync.lastResult
export const selectSyncOk = (state) => state.sync.syncOk
export const selectSessionSyncOk = (state) => state.sync.sessionSyncOk
export const selectBootstrapDone = (state) => state.sync.bootstrapDone
export const selectCloudConfigured = (state) => state.sync.cloudConfigured
export const selectSyncOnline = (state) => state.sync.online
export const selectPendingOutbox = (state) => state.sync.pendingOutbox
export const selectFailedOutbox = (state) => state.sync.failedOutbox
export const selectFailedEvents = (state) => state.sync.failedEvents
export const selectPendingByType = (state) => state.sync.pendingByType
export const selectLastPullAt = (state) => state.sync.lastPullAt
export const selectLastPushAt = (state) => state.sync.lastPushAt
export const selectSyncMeta = (state) => state.sync.meta
export const selectSyncCounts = (state) => state.sync.counts

export default syncSlice.reducer
