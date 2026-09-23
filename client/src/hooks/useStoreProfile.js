import { useCallback, useEffect, useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '@/rtk/hooks'
import {
  fetchStoreProfile,
  selectAdminError,
  selectAdminLoadingStore,
  selectAdminSavingStore,
  selectAdminStore,
  selectAdminStoreForm,
  updateStoreProfile,
} from '@/rtk/features/admin/adminSlice'
import { selectAuthToken } from '@/rtk/features/auth/authSlice'
import { mapFormToStoreProfilePatch } from '@/lib/mapAdmin'
import { toResultError } from '@/api/result'
import i18n from '@/i18n'

const EMPTY_STORE_FORM = {
  name: '',
  branch: '',
  address: '',
  phone: '',
  warning: '',
  returnInstructions: '',
}

/**
 * Admin invoice footer / store profile — GET/PATCH /admin/store-profile.
 */
export function useStoreProfile({ skip = false } = {}) {
  const dispatch = useAppDispatch()
  const token = useAppSelector(selectAuthToken)
  const form = useAppSelector(selectAdminStoreForm)
  const store = useAppSelector(selectAdminStore)
  const loading = useAppSelector(selectAdminLoadingStore)
  const saving = useAppSelector(selectAdminSavingStore)
  const error = useAppSelector(selectAdminError)

  useEffect(() => {
    if (skip || !token) return
    dispatch(fetchStoreProfile())
  }, [skip, token, dispatch])

  // Stable reference when Redux form is null — avoids wiping typed input every render.
  const storeProfile = useMemo(
    () => form || EMPTY_STORE_FORM,
    [form],
  )

  const saveStoreProfile = useCallback(
    async (nextForm) => {
      if (!String(nextForm?.name || '').trim()) {
        return { success: false, error: i18n.t('invoiceDetailsAdmin.nameRequired') }
      }
      try {
        const body = mapFormToStoreProfilePatch(nextForm)
        const result = await dispatch(updateStoreProfile(body)).unwrap()
        return { success: true, data: result.form }
      } catch (err) {
        return toResultError(err)
      }
    },
    [dispatch],
  )

  return {
    storeProfile,
    store: store || null,
    saveStoreProfile,
    isSaving: saving,
    isLoading: loading,
    isLoaded: form != null,
    isError: Boolean(error),
    error: error ? toResultError({ message: error }) : null,
    refetch: () => dispatch(fetchStoreProfile()),
  }
}

export default useStoreProfile
