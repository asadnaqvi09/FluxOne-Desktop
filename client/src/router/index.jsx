import { createBrowserRouter, Navigate } from 'react-router-dom'
import AuthLayout from '@/layouts/AuthLayout'
import CashierLayout from '@/layouts/CashierLayout'
import AdminLayout from '@/layouts/AdminLayout'
import {
  AuthGate,
  GuestGate,
  RequireSync,
  RequireCashDrawer,
  RoleGate,
} from '@/router/guards/AuthGate'
import { PATHS } from '@/router/paths'
import SplashPage from '@/pages/splash/SplashPage'
import SetupWizardPage from '@/pages/setup/SetupWizardPage'
import LoginPage from '@/pages/auth/LoginPage'
import SyncPage from '@/pages/cashier/sync/SyncPage'
import OpenCashDrawerPage from '@/pages/cashier/open-cash-drawer/OpenCashDrawerPage'
import CloseCashDrawerPage from '@/pages/cashier/close-cash-drawer/CloseCashDrawerPage'
import PosPage from '@/pages/cashier/pos/PosPage'
import InvoicesPage from '@/pages/cashier/invoices/InvoicesPage'
import InvoiceDetailPage from '@/pages/cashier/invoices/InvoiceDetailPage'
import NotificationsPage from '@/pages/cashier/notifications/NotificationsPage'
import ProfilePage from '@/pages/shared/ProfilePage'
import ActivityLogsPage from '@/pages/admin/ActivityLogsPage'
import ItemsRatePage from '@/pages/admin/ItemsRatePage'
import CashiersPage from '@/pages/admin/CashiersPage'
import InvoiceDetailsPage from '@/pages/admin/InvoiceDetailsPage'

export const router = createBrowserRouter([
  {
    element: <GuestGate />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: PATHS.splash, element: <SplashPage /> },
          { path: PATHS.setup, element: <SetupWizardPage /> },
          { path: PATHS.login, element: <LoginPage /> },
        ],
      },
    ],
  },
  {
    element: <AuthGate />,
    children: [
      {
        element: <RoleGate allow={['cashier']} />,
        children: [
          {
            element: <CashierLayout />,
            children: [
              { path: PATHS.sync, element: <SyncPage /> },
              { path: PATHS.profile, element: <ProfilePage /> },
              {
                element: <RequireSync />,
                children: [
                  { path: PATHS.openCashDrawer, element: <OpenCashDrawerPage /> },
                  { path: PATHS.closeCashDrawer, element: <CloseCashDrawerPage /> },
                ],
              },
              {
                element: <RequireCashDrawer />,
                children: [
                  { path: PATHS.pos, element: <PosPage /> },
                  { path: PATHS.invoices, element: <InvoicesPage /> },
                  { path: '/invoices/:id', element: <InvoiceDetailPage /> },
                  { path: PATHS.notifications, element: <NotificationsPage /> },
                ],
              },
            ],
          },
        ],
      },
      {
        element: <RoleGate allow={['admin']} />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              { path: PATHS.admin.profile, element: <ProfilePage /> },
              { path: PATHS.admin.logs, element: <ActivityLogsPage /> },
              { path: PATHS.admin.items, element: <ItemsRatePage /> },
              { path: PATHS.admin.cashiers, element: <CashiersPage /> },
              {
                path: PATHS.admin.invoiceDetails,
                element: <InvoiceDetailsPage />,
              },
              {
                path: PATHS.admin.notifications,
                element: <NotificationsPage />,
              },
              {
                path: PATHS.admin.root,
                element: <Navigate to={PATHS.admin.logs} replace />,
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to={PATHS.splash} replace /> },
])
