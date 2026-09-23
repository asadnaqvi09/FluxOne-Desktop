import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { ENDPOINTS } from '@/api/endpoints'
import { apiRequest, toThunkError } from '@/api/apiHelper'
import { mapApiProduct, mapApiProducts } from '@/lib/mapProduct'
import i18n from '@/i18n'
import { clearCredentials } from '@/rtk/features/auth/authSlice'

const initialState = {
  categories: [],
  productsCache: {},
  productBySku: {},
  productsRefreshTick: 0,
  categoriesLoading: false,
  productsLoading: false,
  skuLoading: false,
  error: null,
}

function productsKey(params = {}) {
  return JSON.stringify(params || {})
}

export const fetchCategories = createAsyncThunk(
  'catalog/fetchCategories',
  async (_, { rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.categories, { method: 'GET' })
      return {
        categories: (data?.categories || []).map((c) => ({
          id: c.id,
          name: c.name,
          hasSubcategories: Boolean(c.hasSubcategories),
          sortOrder: c.sortOrder,
        })),
      }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const fetchProducts = createAsyncThunk(
  'catalog/fetchProducts',
  async (params = {}, { rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.products, {
        method: 'GET',
        params,
      })
      return {
        key: productsKey(params),
        needsSubcategory: Boolean(data?.needsSubcategory),
        category: data?.category || null,
        subcategories: (data?.subcategories || []).map((s) => ({
          id: s.id,
          name: s.name,
          categoryId: s.categoryId,
          sortOrder: s.sortOrder,
        })),
        items: mapApiProducts(data?.items || []),
        page: data?.page ?? 1,
        pageSize: data?.pageSize ?? 10,
        total: data?.total ?? 0,
      }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

export const fetchProductBySku = createAsyncThunk(
  'catalog/fetchProductBySku',
  async (sku, { rejectWithValue }) => {
    try {
      const data = await apiRequest(ENDPOINTS.productBySku(sku), {
        method: 'GET',
      })
      return {
        sku,
        product: mapApiProduct(data?.product),
      }
    } catch (error) {
      return rejectWithValue(toThunkError(error))
    }
  },
)

const catalogSlice = createSlice({
  name: 'catalog',
  initialState,
  reducers: {
    resetCatalog() {
      return { ...initialState }
    },
    invalidateProducts(state) {
      state.productsCache = {}
      state.productBySku = {}
      state.productsRefreshTick += 1
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(clearCredentials, () => ({ ...initialState }))
      .addCase(fetchCategories.pending, (state) => {
        state.categoriesLoading = true
        state.error = null
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.categoriesLoading = false
        state.categories = action.payload.categories
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.categoriesLoading = false
        state.error =
          action.payload?.message || i18n.t('errors.loadCategories')
      })
      .addCase(fetchProducts.pending, (state) => {
        state.productsLoading = true
        state.error = null
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.productsLoading = false
        state.productsCache[action.payload.key] = action.payload
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.productsLoading = false
        state.error =
          action.payload?.message || i18n.t('errors.loadProducts')
      })
      .addCase(fetchProductBySku.pending, (state) => {
        state.skuLoading = true
      })
      .addCase(fetchProductBySku.fulfilled, (state, action) => {
        state.skuLoading = false
        state.productBySku[action.payload.sku] = action.payload.product
      })
      .addCase(fetchProductBySku.rejected, (state, action) => {
        state.skuLoading = false
        state.error = action.payload?.message || 'Product not found'
      })
  },
})

export const { resetCatalog, invalidateProducts } = catalogSlice.actions

export const selectCategories = (state) => state.catalog.categories
export const selectProductsCache = (state) => state.catalog.productsCache
export const selectProductsForParams = (params) => (state) =>
  state.catalog.productsCache[productsKey(params)] || null
export const selectProductBySku = (sku) => (state) =>
  state.catalog.productBySku[sku] || null
export const selectCategoriesLoading = (state) =>
  state.catalog.categoriesLoading
export const selectProductsLoading = (state) => state.catalog.productsLoading
export const selectSkuLoading = (state) => state.catalog.skuLoading
export const selectCatalogError = (state) => state.catalog.error
export const selectProductsRefreshTick = (state) =>
  state.catalog.productsRefreshTick

export { productsKey }
export default catalogSlice.reducer
