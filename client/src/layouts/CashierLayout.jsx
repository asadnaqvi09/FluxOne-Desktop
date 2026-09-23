import { Outlet } from 'react-router-dom'
import { TopNav } from '@/layouts/Navbar/TopNav'
import SessionLockModal from '@/components/shared/SessionLockModal'

// Cashier shell - topnav + main content.
// SessionLockModal is mounted once so Lock works on POS and Invoice pages.
export default function CashierLayout() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[var(--app-bg)]">
      <TopNav />
      {/* Page content may grow past the viewport, main scrolls when needed */}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Outlet />
      </main>
      {/* Reusable lock overlay (POS + invoices + any cashier route) */}
      <SessionLockModal />
    </div>
  )
}
