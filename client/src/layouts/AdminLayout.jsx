import { Outlet } from 'react-router-dom'
import { AdminTopNav } from '@/layouts/Navbar/AdminTopNav'
import SessionLockModal from '@/components/shared/SessionLockModal'

// Admin shell - topnav + scrollable main (natural height, no viewport squeeze).
export default function AdminLayout() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[var(--app-bg)]">
      <AdminTopNav />
      <main className="mx-auto w-full max-w-[1440px] flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <SessionLockModal />
    </div>
  )
}
