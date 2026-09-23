import { useCallback, useEffect, useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '@/rtk/hooks'
import {
  fetchProductBySku,
  fetchProducts,
  productsKey,
  selectCatalogError,
  selectProductBySku,
  selectProductsCache,
  selectProductsLoading,
  selectProductsRefreshTick,
  selectSkuLoading,
} from '@/rtk/features/catalog/catalogSlice'
import { DEFAULT_PAGE_SIZE } from '@/lib/constants'
import { toResultError } from '@/api/result'
import i18n from '@/i18n'

/**
 * Build GET /products query params from UI filter state.
 */
export function buildProductListParams({
  categoryId,
  subCategory,
  query,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  popular,
} = {}) {
  const q = (query || '').trim()
  const params = {
    page: page || 1,
    pageSize: pageSize || DEFAULT_PAGE_SIZE,
  }

  if (q) {
    params.q = q
    return params
  }

  const wantPopular =
    popular === true || popular === 1 || categoryId === 'popular'
  if (wantPopular) {
    params.popular = '1'
    return params
  }

  if (categoryId && categoryId !== 'all') params.category = categoryId
  if (subCategory) params.subcategory = subCategory
  return params
}

export function useProducts({
  categoryId,
  subCategory,
  query,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  popular,
  skip = false,
} = {}) {
  const dispatch = useAppDispatch()
  const params = useMemo(
    () =>
      buildProductListParams({
        categoryId,
        subCategory,
        query,
        page,
        pageSize,
        popular,
      }),
    [categoryId, subCategory, query, page, pageSize, popular],
  )

  const cache = useAppSelector(selectProductsCache)
  const refreshTick = useAppSelector(selectProductsRefreshTick)
  const data = cache[productsKey(params)] || null
  const loading = useAppSelector(selectProductsLoading)
  const error = useAppSelector(selectCatalogError)

  useEffect(() => {
    if (skip) return
    dispatch(fetchProducts(params))
  }, [skip, params, dispatch, refreshTick])

  const total = data?.total ?? 0
  const size = data?.pageSize ?? pageSize
  const pageCount = Math.max(1, Math.ceil(total / (size || 1)) || 1)

  return {
    products: data?.items || [],
    total,
    page: data?.page ?? page,
    pageSize: size,
    pageCount,
    needsSubcategory: Boolean(data?.needsSubcategory),
    category: data?.category || null,
    subcategories: data?.subcategories || [],
    isLoading: loading && !data,
    isFetching: loading,
    isError: Boolean(error) && !data,
    error: error ? toResultError({ message: error }) : null,
    refetch: () => dispatch(fetchProducts(params)),
  }
}

export function useProductBySku(sku, { skip = false } = {}) {
  const dispatch = useAppDispatch()
  const code = String(sku || '').trim()
  const product = useAppSelector(selectProductBySku(code))
  const loading = useAppSelector(selectSkuLoading)
  const error = useAppSelector(selectCatalogError)

  useEffect(() => {
    if (skip || !code) return
    dispatch(fetchProductBySku(code))
  }, [skip, code, dispatch])

  return {
    product: product || null,
    isLoading: loading,
    isError: Boolean(error) && !product,
    error: error ? toResultError({ message: error }) : null,
    refetch: () => (code ? dispatch(fetchProductBySku(code)) : undefined),
  }
}

export function useProductSkuLookup() {
  const dispatch = useAppDispatch()
  const loading = useAppSelector(selectSkuLoading)

  const lookup = useCallback(
    async (sku) => {
      const code = String(sku || '').trim()
      if (!code) {
        return { success: false, error: i18n.t('cart.enterSkuOrBarcode') }
      }
      try {
        const data = await dispatch(fetchProductBySku(code)).unwrap()
        if (!data?.product) {
          return { success: false, error: i18n.t('cart.skuNotRecognized') }
        }
        return { success: true, data: { product: data.product } }
      } catch (err) {
        const mapped = toResultError(err)
        if (mapped.status === 404) {
          return { success: false, error: i18n.t('cart.skuNotRecognized') }
        }
        return mapped
      }
    },
    [dispatch],
  )

  return {
    lookup,
    isLoading: loading,
  }
}

export default useProducts
