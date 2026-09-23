import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { ENDPOINTS } from '@/api/endpoints'
import { toStoreTime } from '@/api/result'
import { apiRequest, toThunkError } from '@/api/apiHelper'
import { clearCredentials } from '@/rtk/features/auth/authSlice'
import i18n from '@/i18n'

function mapNotification(row) {
  if (!row) return null
  const title = row.title || ''
  const body = row.body || ''
  return {
    id: row.id,
    title,
    body,
    message: [title, body].filter(Boolean).join(' — ') || 'Notification',
    type: row.source || 'system',
    source: row.source,
    audience: row.audience,
    at: toStoreTime(row.createdAt),
    read: Boolean(row.isRead),
    isRead: Boolean(row.isRead),
  }
}

const initialState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  marking: false,
  clearing: false,
  error: null,
}

export const fetchNotifications = createAsyncThunk(
  'notifications/fetchList',
  async (params = {}, { rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.notifications.list, {
        method: 'GET',
        params,
      })
      return {
        notifications: (data?.notifications || [])
          .map(mapNotification)
          .filter(Boolean),
        unreadCount: Number(data?.unreadCount) || 0,
      }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const markNotificationRead = createAsyncThunk(
  'notifications/markRead',
  async (id, { dispatch, rejectWithValue }) => {
    try {
      await apiRequest(ENDPOINTS.notifications.read(id), { method: 'POST' })
      await dispatch(fetchNotifications())
      return { id }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const clearNotifications = createAsyncThunk(
  'notifications/clear',
  async (_, { rejectWithValue }) => {
    try {
      await apiRequest(ENDPOINTS.notifications.clear, { method: 'DELETE' })
      return { success: true }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    resetNotifications() {
      return { ...initialState }
    },
    /** Local invalidate — re-fetch is triggered by hooks/AuthContext */
    invalidateNotificationsList() {
      /* no-op marker; hooks call fetchNotifications */
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(clearCredentials, () => ({ ...initialState }))
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false
        state.notifications = action.payload.notifications
        state.unreadCount = action.payload.unreadCount
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false
        state.error =
          action.payload?.message || i18n.t('errors.loadNotifications')
      })
      .addCase(markNotificationRead.pending, (state) => {
        state.marking = true
      })
      .addCase(markNotificationRead.fulfilled, (state) => {
        state.marking = false
      })
      .addCase(markNotificationRead.rejected, (state, action) => {
        state.marking = false
        state.error =
          action.payload?.message || i18n.t('errors.markRead')
      })
      .addCase(clearNotifications.pending, (state) => {
        state.clearing = true
      })
      .addCase(clearNotifications.fulfilled, (state) => {
        state.clearing = false
        state.notifications = []
        state.unreadCount = 0
      })
      .addCase(clearNotifications.rejected, (state, action) => {
        state.clearing = false
        state.error =
          action.payload?.message || i18n.t('errors.clearNotifications')
      })
  },
})

export const { resetNotifications, invalidateNotificationsList } =
  notificationsSlice.actions

export const selectNotifications = (state) => state.notifications.notifications
export const selectUnreadCount = (state) => state.notifications.unreadCount
export const selectNotificationsLoading = (state) => state.notifications.loading
export const selectNotificationsMarking = (state) => state.notifications.marking
export const selectNotificationsClearing = (state) =>
  state.notifications.clearing
export const selectNotificationsError = (state) => state.notifications.error

export default notificationsSlice.reducer
