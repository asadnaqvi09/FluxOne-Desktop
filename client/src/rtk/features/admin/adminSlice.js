import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { ENDPOINTS } from '@/api/endpoints'
import { apiRequest, toThunkError } from '@/api/apiHelper'
import i18n from '@/i18n'
import {
  mapAdminLogs,
  mapAdminProduct,
  mapAdminProducts,
  mapEmployee,
  mapEmployees,
  mapStoreProfileToForm,
} from '@/lib/mapAdmin'
import { clearCredentials } from '@/rtk/features/auth/authSlice'

const initialState = {
  logs: [],
  logsCount: 0,
  productsCache: {},
  productsKey: '',
  products: [],
  productsTotal: 0,
  productsPage: 1,
  productsPageSize: 50,
  categoryMetaItems: [],
  productById: {},
  employees: [],
  currentCashier: null,
  store: null,
  storeForm: null,
  loadingLogs: false,
  loadingProducts: false,
  loadingProduct: false,
  loadingEmployees: false,
  loadingCashier: false,
  loadingStore: false,
  updatingProduct: false,
  assigning: false,
  updatingEmployee: false,
  savingStore: false,
  error: null,
}

export const fetchAdminLogs = createAsyncThunk(
  'admin/fetchLogs',
  async (params = {}, { rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.admin.logs, {
        method: 'GET',
        params,
      })
      return {
        logs: mapAdminLogs(data?.logs || []),
        count: data?.count ?? 0,
      }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const fetchAdminProducts = createAsyncThunk(
  'admin/fetchProducts',
  async (params = {}, { rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.admin.products, {
        method: 'GET',
        params,
      })
      return {
        key: JSON.stringify(params || {}),
        items: mapAdminProducts(data?.items || []),
        total: data?.total ?? 0,
        page: data?.page ?? 1,
        pageSize: data?.pageSize ?? 50,
        isMeta: params?.pageSize === 100 && !params?.q && !params?.category,
      }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const fetchAdminProduct = createAsyncThunk(
  'admin/fetchProduct',
  async (id, { rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.admin.product(id), {
        method: 'GET',
      })
      return {
        id,
        product: mapAdminProduct(data?.product),
        taxRules: data?.taxRules || [],
      }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const updateAdminProduct = createAsyncThunk(
  'admin/updateProduct',
  async ({ id, ...body }, { dispatch, rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.admin.product(id), {
        method: 'PATCH',
        body,
      })
      await dispatch(fetchAdminProducts())
      return { product: mapAdminProduct(data?.product) }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const fetchEmployees = createAsyncThunk(
  'admin/fetchEmployees',
  async (params = {}, { rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.admin.employees, {
        method: 'GET',
        params,
      })
      return { employees: mapEmployees(data?.employees || []) }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const fetchCurrentCashier = createAsyncThunk(
  'admin/fetchCurrentCashier',
  async (_, { rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.admin.cashiersCurrent, {
        method: 'GET',
      })
      return { cashier: mapEmployee(data?.cashier) }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const assignCashier = createAsyncThunk(
  'admin/assignCashier',
  async ({ employeeId }, { dispatch, rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.admin.cashiersAssign, {
        method: 'POST',
        body: { employeeId },
      })
      await dispatch(fetchCurrentCashier())
      await dispatch(fetchEmployees({ role: 'cashier' }))
      return { cashier: mapEmployee(data?.cashier) }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const updateEmployee = createAsyncThunk(
  'admin/updateEmployee',
  async ({ id, ...body }, { dispatch, rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.admin.employee(id), {
        method: 'PATCH',
        body,
      })
      await dispatch(fetchEmployees({ role: 'cashier' }))
      await dispatch(fetchCurrentCashier())
      return { employee: mapEmployee(data?.employee) }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const fetchStoreProfile = createAsyncThunk(
  'admin/fetchStoreProfile',
  async (_, { rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.admin.storeProfile, {
        method: 'GET',
      })
      return {
        store: data?.store || null,
        form: mapStoreProfileToForm(data?.store),
      }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const updateStoreProfile = createAsyncThunk(
  'admin/updateStoreProfile',
  async (body, { rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.admin.storeProfile, {
        method: 'PATCH',
        body,
      })
      return {
        store: data?.store || null,
        form: mapStoreProfileToForm(data?.store),
      }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    resetAdmin() {
      return { ...initialState }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(clearCredentials, () => ({ ...initialState }))
      .addCase(fetchAdminLogs.pending, (state) => {
        state.loadingLogs = true
      })
      .addCase(fetchAdminLogs.fulfilled, (state, action) => {
        state.loadingLogs = false
        state.logs = action.payload.logs
        state.logsCount = action.payload.count
      })
      .addCase(fetchAdminLogs.rejected, (state, action) => {
        state.loadingLogs = false
        state.error = action.payload?.message || i18n.t('errors.loadLogs')
      })
      .addCase(fetchAdminProducts.pending, (state) => {
        state.loadingProducts = true
      })
      .addCase(fetchAdminProducts.fulfilled, (state, action) => {
        state.loadingProducts = false
        if (action.payload.isMeta) {
          state.categoryMetaItems = action.payload.items
          return
        }
        state.products = action.payload.items
        state.productsTotal = action.payload.total
        state.productsPage = action.payload.page
        state.productsPageSize = action.payload.pageSize
        state.productsKey = action.payload.key
        state.productsCache[action.payload.key] = action.payload
      })
      .addCase(fetchAdminProducts.rejected, (state, action) => {
        state.loadingProducts = false
        state.error =
          action.payload?.message || i18n.t('errors.loadProducts')
      })
      .addCase(fetchAdminProduct.pending, (state) => {
        state.loadingProduct = true
      })
      .addCase(fetchAdminProduct.fulfilled, (state, action) => {
        state.loadingProduct = false
        state.productById[action.payload.id] = {
          product: action.payload.product,
          taxRules: action.payload.taxRules,
        }
      })
      .addCase(fetchAdminProduct.rejected, (state, action) => {
        state.loadingProduct = false
        state.error =
          action.payload?.message || i18n.t('errors.loadProduct')
      })
      .addCase(updateAdminProduct.pending, (state) => {
        state.updatingProduct = true
      })
      .addCase(updateAdminProduct.fulfilled, (state) => {
        state.updatingProduct = false
      })
      .addCase(updateAdminProduct.rejected, (state, action) => {
        state.updatingProduct = false
        state.error =
          action.payload?.message || i18n.t('errors.updateProduct')
      })
      .addCase(fetchEmployees.pending, (state) => {
        state.loadingEmployees = true
      })
      .addCase(fetchEmployees.fulfilled, (state, action) => {
        state.loadingEmployees = false
        state.employees = action.payload.employees
      })
      .addCase(fetchEmployees.rejected, (state, action) => {
        state.loadingEmployees = false
        state.error =
          action.payload?.message || i18n.t('errors.loadEmployees')
      })
      .addCase(fetchCurrentCashier.pending, (state) => {
        state.loadingCashier = true
      })
      .addCase(fetchCurrentCashier.fulfilled, (state, action) => {
        state.loadingCashier = false
        state.currentCashier = action.payload.cashier
      })
      .addCase(fetchCurrentCashier.rejected, (state, action) => {
        state.loadingCashier = false
        if (action.payload?.status === 404) {
          state.currentCashier = null
          return
        }
        state.error =
          action.payload?.message || i18n.t('errors.loadCashier')
      })
      .addCase(assignCashier.pending, (state) => {
        state.assigning = true
      })
      .addCase(assignCashier.fulfilled, (state, action) => {
        state.assigning = false
        state.currentCashier = action.payload.cashier
      })
      .addCase(assignCashier.rejected, (state, action) => {
        state.assigning = false
        state.error =
          action.payload?.message || i18n.t('errors.assignCashier')
      })
      .addCase(updateEmployee.pending, (state) => {
        state.updatingEmployee = true
      })
      .addCase(updateEmployee.fulfilled, (state) => {
        state.updatingEmployee = false
      })
      .addCase(updateEmployee.rejected, (state, action) => {
        state.updatingEmployee = false
        state.error =
          action.payload?.message || i18n.t('errors.updateEmployee')
      })
      .addCase(fetchStoreProfile.pending, (state) => {
        state.loadingStore = true
      })
      .addCase(fetchStoreProfile.fulfilled, (state, action) => {
        state.loadingStore = false
        state.store = action.payload.store
        state.storeForm = action.payload.form
      })
      .addCase(fetchStoreProfile.rejected, (state, action) => {
        state.loadingStore = false
        state.error =
          action.payload?.message || i18n.t('errors.loadStoreProfile')
      })
      .addCase(updateStoreProfile.pending, (state) => {
        state.savingStore = true
      })
      .addCase(updateStoreProfile.fulfilled, (state, action) => {
        state.savingStore = false
        state.store = action.payload.store
        state.storeForm = action.payload.form
      })
      .addCase(updateStoreProfile.rejected, (state, action) => {
        state.savingStore = false
        state.error =
          action.payload?.message || i18n.t('errors.saveStoreProfile')
      })
  },
})

export const { resetAdmin } = adminSlice.actions

export const selectAdminLogs = (state) => state.admin.logs
export const selectAdminProducts = (state) => state.admin.products
export const selectAdminCategoryMeta = (state) => state.admin.categoryMetaItems
export const selectAdminProductById = (id) => (state) =>
  state.admin.productById[id] || null
export const selectAdminEmployees = (state) => state.admin.employees
export const selectAdminCurrentCashier = (state) => state.admin.currentCashier
export const selectAdminStoreForm = (state) => state.admin.storeForm
export const selectAdminStore = (state) => state.admin.store
export const selectAdminLoadingLogs = (state) => state.admin.loadingLogs
export const selectAdminLoadingProducts = (state) => state.admin.loadingProducts
export const selectAdminLoadingProduct = (state) => state.admin.loadingProduct
export const selectAdminUpdatingProduct = (state) => state.admin.updatingProduct
export const selectAdminLoadingEmployees = (state) =>
  state.admin.loadingEmployees
export const selectAdminLoadingCashier = (state) => state.admin.loadingCashier
export const selectAdminAssigning = (state) => state.admin.assigning
export const selectAdminUpdatingEmployee = (state) =>
  state.admin.updatingEmployee
export const selectAdminLoadingStore = (state) => state.admin.loadingStore
export const selectAdminSavingStore = (state) => state.admin.savingStore
export const selectAdminError = (state) => state.admin.error

export default adminSlice.reducer
