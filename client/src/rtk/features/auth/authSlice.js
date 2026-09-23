import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { ENDPOINTS } from '@/api/endpoints'
import { clearToken, getToken, setToken } from '@/api/tokenStorage'
import { apiRequest, toThunkError } from '@/api/apiHelper'

const initialState = {
  token: getToken(),
  employee: null,
  session: null,
  cashDrawerOpen: false,
  idleMinutes: null,
  expiresAt: null,
  loading: false,
  meLoading: false,
  error: null,
}

export const loginUser = createAsyncThunk(
  'auth/login',
  async (formData, { rejectWithValue }) => {
    try {
      return await apiRequest(ENDPOINTS.auth.login, {
        method: 'POST',
        body: formData,
      })
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      return await apiRequest(ENDPOINTS.auth.logout, { method: 'POST' })
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const fetchMe = createAsyncThunk(
  'auth/me',
  async (_, { rejectWithValue }) => {
    try {
      return await apiRequest(ENDPOINTS.auth.me, { method: 'GET' })
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (body, { rejectWithValue }) => {
    try {
      return await apiRequest(ENDPOINTS.auth.me, {
        method: 'PATCH',
        body,
      })
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const lockSession = createAsyncThunk(
  'auth/lock',
  async (_, { rejectWithValue }) => {
    try {
      return await apiRequest(ENDPOINTS.auth.lock, { method: 'POST' })
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const unlockSession = createAsyncThunk(
  'auth/unlock',
  async (body, { rejectWithValue }) => {
    try {
      return await apiRequest(ENDPOINTS.auth.unlock, {
        method: 'POST',
        body,
      })
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action) {
      const {
        token,
        employee,
        session,
        cashDrawerOpen = false,
        idleMinutes = null,
        expiresAt = null,
      } = action.payload
      if (token) {
        state.token = token
        setToken(token)
      }
      if (employee) state.employee = employee
      if (session) state.session = session
      state.cashDrawerOpen = Boolean(cashDrawerOpen)
      if (idleMinutes != null) state.idleMinutes = idleMinutes
      if (expiresAt != null) state.expiresAt = expiresAt
      else if (session?.expiresAt) state.expiresAt = session.expiresAt
    },
    patchSession(state, action) {
      state.session = { ...(state.session || {}), ...action.payload }
    },
    setCashDrawerOpen(state, action) {
      state.cashDrawerOpen = Boolean(action.payload)
    },
    clearCredentials(state) {
      state.token = null
      state.employee = null
      state.session = null
      state.cashDrawerOpen = false
      state.idleMinutes = null
      state.expiresAt = null
      state.error = null
      clearToken()
    },
    resetAuthError(state) {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false
        const data = action.payload || {}
        if (data.token) {
          state.token = data.token
          setToken(data.token)
        }
        state.employee = data.employee || null
        state.session = data.session || null
        state.idleMinutes = data.idleMinutes ?? null
        state.expiresAt = data.expiresAt ?? data.session?.expiresAt ?? null
        state.cashDrawerOpen = false
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload?.message || 'Login failed'
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.token = null
        state.employee = null
        state.session = null
        state.cashDrawerOpen = false
        state.idleMinutes = null
        state.expiresAt = null
        state.error = null
        state.loading = false
        clearToken()
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload?.message || 'Logout failed'
      })
      .addCase(fetchMe.pending, (state) => {
        state.meLoading = true
        state.error = null
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.meLoading = false
        const data = action.payload || {}
        if (data.employee) state.employee = data.employee
        if (data.session) state.session = data.session
        state.cashDrawerOpen = Boolean(data.cashDrawerOpen)
        if (data.idleMinutes != null) state.idleMinutes = data.idleMinutes
        state.expiresAt = data.session?.expiresAt ?? state.expiresAt
        // Cookie-only restore: mark session without writing JWT to JS storage
        if (!state.token && data.employee) state.token = '__cookie__'
      })
      .addCase(fetchMe.rejected, (state, action) => {
        state.meLoading = false
        state.error = action.payload?.message || 'Session restore failed'
        if (action.payload?.status === 401) {
          state.token = null
          state.employee = null
          state.session = null
          clearToken()
        }
      })
      .addCase(updateProfile.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.loading = false
        if (action.payload?.employee) state.employee = action.payload.employee
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload?.message || 'Profile update failed'
      })
      .addCase(lockSession.fulfilled, (state) => {
        state.session = { ...(state.session || {}), isLocked: true }
      })
      .addCase(unlockSession.fulfilled, (state) => {
        state.session = { ...(state.session || {}), isLocked: false }
      })
  },
})

export const {
  setCredentials,
  patchSession,
  setCashDrawerOpen,
  clearCredentials,
  resetAuthError,
} = authSlice.actions

export const selectAuthToken = (state) => state.auth.token
export const selectAuthEmployee = (state) => state.auth.employee
export const selectAuthSession = (state) => state.auth.session
export const selectAuthCashDrawerOpen = (state) => state.auth.cashDrawerOpen
export const selectAuthIdleMinutes = (state) => state.auth.idleMinutes
export const selectAuthLoading = (state) => state.auth.loading
export const selectAuthMeLoading = (state) => state.auth.meLoading
export const selectAuthError = (state) => state.auth.error

export default authSlice.reducer
