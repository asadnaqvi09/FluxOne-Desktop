import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { PATHS } from '@/router/paths'

function AuthBootSplash() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
      {t('authGate.restoringSession')}
    </div>
  )
}

// Requires any logged-in user
export function AuthGate() {
  const { isAuthenticated, authReady, isRestoring } = useAuth()
  const location = useLocation()

  if (!authReady || isRestoring) return <AuthBootSplash />
  if (!isAuthenticated) {
    return <Navigate to={PATHS.login} replace state={{ from: location }} />
  }
  return <Outlet />
}

// Redirects authenticated users away from splash/login
export function GuestGate() {
  const {
    isAuthenticated,
    authReady,
    isRestoring,
    user,
    syncOk,
    cashDrawerOpen,
    sessionNoticePending,
  } = useAuth()

  if (!authReady || isRestoring) return <AuthBootSplash />
  if (!isAuthenticated) return <Outlet />
  // Stay on login while the 24h session info modal is open
  if (sessionNoticePending) return <Outlet />

  if (user?.role === 'admin') {
    return <Navigate to={PATHS.admin.logs} replace />
  }
  if (!syncOk) return <Navigate to={PATHS.sync} replace />
  if (!cashDrawerOpen) return <Navigate to={PATHS.openCashDrawer} replace />
  return <Navigate to={PATHS.pos} replace />
}

// Cashier-only routes
export function RoleGate({ allow = [] }) {
  const { user, authReady, isRestoring } = useAuth()
  if (!authReady || isRestoring) return <AuthBootSplash />
  if (!user || !allow.includes(user.role)) {
    return <Navigate to={PATHS.login} replace />
  }
  return <Outlet />
}

// Cashier day funnel: Sync only when login required it (first use / after 24h);
// otherwise Open Cash Drawer is step 1. POS needs an open drawer.
export function RequireSync() {
  const { syncOk } = useAuth()
  if (!syncOk) return <Navigate to={PATHS.sync} replace />
  return <Outlet />
}

export function RequireCashDrawer() {
  const { cashDrawerOpen } = useAuth()
  if (!cashDrawerOpen) return <Navigate to={PATHS.openCashDrawer} replace />
  return <Outlet />
}
