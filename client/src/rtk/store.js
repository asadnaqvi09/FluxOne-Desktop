import { configureStore } from '@reduxjs/toolkit'
import authReducer from '@/rtk/features/auth/authSlice'
import salesReducer from '@/rtk/features/sales/salesSlice'
import invoicesReducer from '@/rtk/features/invoices/invoicesSlice'
import catalogReducer from '@/rtk/features/catalog/catalogSlice'
import cashDrawerReducer from '@/rtk/features/cashDrawer/cashDrawerSlice'
import syncReducer from '@/rtk/features/sync/syncSlice'
import notificationsReducer from '@/rtk/features/notifications/notificationsSlice'
import adminReducer from '@/rtk/features/admin/adminSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    sales: salesReducer,
    invoices: invoicesReducer,
    catalog: catalogReducer,
    cashDrawer: cashDrawerReducer,
    sync: syncReducer,
    notifications: notificationsReducer,
    admin: adminReducer,
  },
})

export default store
