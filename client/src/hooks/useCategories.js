import { useEffect, useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '@/rtk/hooks'
import {
  fetchCategories,
  selectCatalogError,
  selectCategories,
  selectCategoriesLoading,
} from '@/rtk/features/catalog/catalogSlice'
import { DEFAULT_PAGE_SIZE } from '@/lib/constants'

const ALL_CATEGORY = {
  id: 'all',
  name: 'All',
  hasSubcategories: false,
  sortOrder: 0,
}

/**
 * Category chips for POS — All + GET /categories.
 */
export function useCategories() {
  const dispatch = useAppDispatch()
  const fromApi = useAppSelector(selectCategories)
  const loading = useAppSelector(selectCategoriesLoading)
  const error = useAppSelector(selectCatalogError)

  useEffect(() => {
    dispatch(fetchCategories())
  }, [dispatch])

  const categories = useMemo(
    () => [ALL_CATEGORY, ...fromApi],
    [fromApi],
  )

  return {
    categories,
    isLoading: loading,
    isFetching: loading,
    isError: Boolean(error),
    error: error ? { message: error } : null,
    refetch: () => dispatch(fetchCategories()),
    pageSize: DEFAULT_PAGE_SIZE,
  }
}

export default useCategories
