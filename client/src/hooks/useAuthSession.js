import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '@/rtk/hooks'
import {
  clearCredentials,
  fetchMe,
  lockSession as lockSessionThunk,
  loginUser,
  logoutUser,
  selectAuthCashDrawerOpen,
  selectAuthEmployee,
  selectAuthError,
  selectAuthIdleMinutes,
  selectAuthLoading,
  selectAuthMeLoading,
  selectAuthSession,
  selectAuthToken,
  unlockSession as unlockSessionThunk,
  updateProfile as updateProfileThunk,
} from '@/rtk/features/auth/authSlice'
import { IDLE_MINUTES } from '@/lib/constants'
import { toResultError } from '@/api/result'
import i18n from '@/i18n'

function initialsFromName(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '??'
  return parts
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/** Map API employee → UI user shape used by layouts / guards */
export function mapEmployeeToUser(employee, { expiresAt } = {}) {
  if (!employee) return null
  let sessionExpiresAt = null
  if (expiresAt) {
    const ms = Date.parse(String(expiresAt).replace(' ', 'T') + 'Z')
    sessionExpiresAt = Number.isNaN(ms) ? null : ms
  }
  return {
    userId: employee.userId,
    employeeId: employee.id,
    name: employee.name,
    role: employee.role,
    email: employee.email || '',
    initials: initialsFromName(employee.name),
    pictureUrl: employee.pictureUrl ?? null,
    sessionExpiresAt,
  }
}

/**
 * UI-facing auth session API.
 */
export function useAuthSession() {
  const dispatch = useAppDispatch()
  const token = useAppSelector(selectAuthToken)
  const employee = useAppSelector(selectAuthEmployee)
  const session = useAppSelector(selectAuthSession)
  const cashDrawerOpenFromStore = useAppSelector(selectAuthCashDrawerOpen)
  const idleFromStore = useAppSelector(selectAuthIdleMinutes)
  const loading = useAppSelector(selectAuthLoading)
  const meLoading = useAppSelector(selectAuthMeLoading)
  const authError = useAppSelector(selectAuthError)
  const bootProbed = useRef(false)

  // Restore via Bearer token and/or HttpOnly cookie (credentials: include)
  useEffect(() => {
    if (employee || bootProbed.current) return
    bootProbed.current = true
    dispatch(fetchMe())
  }, [employee, dispatch])

  const isRestoring = !employee && (meLoading || !bootProbed.current)
  const authReady =
    Boolean(employee) ||
    (bootProbed.current && !meLoading) ||
    Boolean(authError && !meLoading)

  const user = useMemo(
    () =>
      mapEmployeeToUser(employee, {
        expiresAt: session?.expiresAt,
      }),
    [employee, session],
  )

  const idleMinutes = idleFromStore ?? IDLE_MINUTES
  const hasSession = Boolean(employee) || Boolean(token)

  const login = useCallback(
    async ({ userId, password }) => {
      try {
        const data = await dispatch(
          loginUser({
            userId: String(userId || '').trim(),
            password,
          }),
        ).unwrap()
        return {
          success: true,
          data: {
            role: data.employee?.role,
            employee: data.employee,
            session: data.session,
            token: data.token,
            expiresAt: data.expiresAt,
            idleMinutes: data.idleMinutes,
          },
        }
      } catch (err) {
        return toResultError(err)
      }
    },
    [dispatch],
  )

  const logout = useCallback(async () => {
    if (!hasSession) {
      dispatch(clearCredentials())
      return { success: true, data: { loggedOut: true } }
    }
    try {
      const data = await dispatch(logoutUser()).unwrap()
      return { success: true, data }
    } catch (err) {
      return toResultError(err)
    }
  }, [dispatch, hasSession])

  const lockSession = useCallback(async () => {
    if (!hasSession) return { success: false, error: i18n.t('profile.notSignedIn') }
    if (session?.isLocked) return { success: true, data: { isLocked: true } }
    try {
      const data = await dispatch(lockSessionThunk()).unwrap()
      return { success: true, data }
    } catch (err) {
      return toResultError(err)
    }
  }, [hasSession, session?.isLocked, dispatch])

  const unlockSession = useCallback(
    async ({ value } = {}) => {
      if (!hasSession) return { success: false, error: i18n.t('profile.notSignedIn') }
      const unlockValue = String(value || '').trim()
      if (!unlockValue) {
        return {
          success: false,
          error: i18n.t('sessionLock.enterPassword'),
        }
      }
      try {
        const data = await dispatch(
          unlockSessionThunk({
            method: 'password',
            value: unlockValue,
          }),
        ).unwrap()
        return { success: true, data }
      } catch (err) {
        return toResultError(err)
      }
    },
    [hasSession, dispatch],
  )

  const updateProfile = useCallback(
    async ({ name, email } = {}) => {
      if (!hasSession) return { success: false, error: i18n.t('profile.notSignedIn') }
      const body = {}
      if (name !== undefined) body.name = String(name).trim()
      if (email !== undefined) body.email = String(email).trim()
      if (!Object.keys(body).length) {
        return { success: false, error: i18n.t('profile.nothingToUpdate') }
      }
      try {
        const data = await dispatch(updateProfileThunk(body)).unwrap()
        return { success: true, data: data.employee }
      } catch (err) {
        return toResultError(err)
      }
    },
    [hasSession, dispatch],
  )

  const forceClear = useCallback(() => {
    dispatch(clearCredentials())
  }, [dispatch])

  const refetchMe = useCallback(() => dispatch(fetchMe()), [dispatch])

  return {
    token,
    user,
    employee,
    session,
    cashDrawerOpen: cashDrawerOpenFromStore,
    idleMinutes,
    sessionLocked: Boolean(session?.isLocked),
    isAuthenticated: Boolean(user),
    isRestoring,
    authReady,
    isLoginLoading: loading,
    isLogoutLoading: loading,
    isLockLoading: loading,
    isUnlockLoading: loading,
    isUpdatingProfile: loading,
    meError: authError && !employee ? toResultError({ message: authError }) : null,
    login,
    logout,
    lockSession,
    unlockSession,
    updateProfile,
    forceClear,
    refetchMe,
  }
}

export default useAuthSession
