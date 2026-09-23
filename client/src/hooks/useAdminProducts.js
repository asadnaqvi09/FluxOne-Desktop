import { useCallback, useEffect, useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '@/rtk/hooks'
import {
  fetchAdminProduct,
  fetchAdminProducts,
  selectAdminCategoryMeta,
  selectAdminError,
  selectAdminLoadingProducts,
  selectAdminProducts,
  selectAdminUpdatingProduct,
  updateAdminProduct,
} from '@/rtk/features/admin/adminSlice'
import { selectAuthToken } from '@/rtk/features/auth/authSlice'
import {
  buildAdminCategoryOptions,
  buildAdminProductParams,
} from '@/lib/mapAdmin'
import { toResultError } from '@/api/result'
import { ADMIN_ITEM_PAGE_SIZE } from '@/data/products'
import i18n from '@/i18n'

/**
 * Admin Items Rate — GET/PATCH /admin/products.
 */
export function useAdminProducts({
  query = '',
  categoryId = '',
  sub = '',
  page = 1,
  pageSize = ADMIN_ITEM_PAGE_SIZE,
  skip = false,
} = {}) {
  const dispatch = useAppDispatch()
  const token = useAppSelector(selectAuthToken)
  const products = useAppSelector(selectAdminProducts)
  const metaItems = useAppSelector(selectAdminCategoryMeta)
  const loading = useAppSelector(selectAdminLoadingProducts)
  const updating = useAppSelector(selectAdminUpdatingProduct)
  const error = useAppSelector(selectAdminError)
  const productsTotal = useAppSelector((s) => s.admin.productsTotal)
  const productsPage = useAppSelector((s) => s.admin.productsPage)
  const productsPageSize = useAppSelector((s) => s.admin.productsPageSize)

  const listParams = useMemo(
    () =>
      buildAdminProductParams({
        query,
        categoryId,
        sub,
        page,
        pageSize,
      }),
    [query, categoryId, sub, page, pageSize],
  )

  const metaParams = useMemo(() => ({ page: 1, pageSize: 100 }), [])

  useEffect(() => {
    if (skip || !token) return
    dispatch(fetchAdminProducts(listParams))
  }, [skip, token, listParams, dispatch])

  useEffect(() => {
    if (skip || !token) return
    dispatch(fetchAdminProducts(metaParams))
  }, [skip, token, metaParams, dispatch])

  const categories = useMemo(
    () => buildAdminCategoryOptions(metaItems.length ? metaItems : products),
    [metaItems, products],
  )

  const total = productsTotal ?? 0
  const size = productsPageSize ?? pageSize
  const pageCount = Math.max(1, Math.ceil(total / (size || 1)) || 1)

  const updateProductRates = useCallback(
    async (productId, patch) => {
      if (!productId) return { success: false, error: i18n.t('itemsRate.productIdRequired') }
      try {
        const body = {}
        if (patch.price !== undefined && patch.price !== '') {
          body.price = Number(patch.price)
        }
        if (patch.discountPct !== undefined && patch.discountPct !== '') {
          body.discount = Number(patch.discountPct) || 0
        }
        if (Array.isArray(patch.taxRates)) {
          body.taxRates = patch.taxRates.map((r) => Number(r) || 0)
        } else if (Array.isArray(patch.taxRuleIds)) {
          body.taxRuleIds = patch.taxRuleIds
        }

        if (
          body.price === undefined &&
          body.discount === undefined &&
          body.taxRuleIds === undefined &&
          body.taxRates === undefined
        ) {
          return { success: false, error: i18n.t('itemsRate.noRateChanges') }
        }

        const result = await dispatch(
          updateAdminProduct({ id: productId, ...body }),
        ).unwrap()
        await dispatch(fetchAdminProducts(listParams))
        return { success: true, data: result.product }
      } catch (err) {
        return toResultError(err)
      }
    },
    [dispatch, listParams],
  )

  return {
    products: products || [],
    total,
    page: productsPage ?? page,
    pageSize: size,
    pageCount,
    categories,
    pageSizeDefault: ADMIN_ITEM_PAGE_SIZE,
    updateProductRates,
    isUpdating: updating,
    isLoading: loading,
    isError: Boolean(error),
    error: error ? toResultError({ message: error }) : null,
    refetch: () => dispatch(fetchAdminProducts(listParams)),
  }
}

export default useAdminProducts
