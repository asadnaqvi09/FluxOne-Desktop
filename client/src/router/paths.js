// Central route map - use these instead of hard-coded strings
export const PATHS = {
  splash: '/',
  setup: '/setup',
  login: '/login',
  sync: '/sync',
  openCashDrawer: '/open-cash-drawer',
  pos: '/pos',
  invoices: '/invoices',
  invoiceDetail: (id) => `/invoices/${id}`,
  profile: '/profile',
  notifications: '/notifications',
  closeCashDrawer: '/close-cash-drawer',
  admin: {
    root: '/admin',
    logs: '/admin/logs',
    items: '/admin/items',
    cashiers: '/admin/cashiers',
    invoiceDetails: '/admin/invoice-details',
    notifications: '/admin/notifications',
    profile: '/admin/profile',
  },
}
