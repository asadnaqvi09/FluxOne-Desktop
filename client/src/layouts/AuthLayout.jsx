import { Outlet } from 'react-router-dom'

// Splash / Login - no topnav
export default function AuthLayout() {
  return (
    <div className="min-h-dvh">
      <Outlet />
    </div>
  )
}
