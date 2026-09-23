import { useNavigate } from 'react-router-dom'
import { ChevronDown, Lock, LogOut, Moon, Sun, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { PATHS } from '@/router/paths'
import { cn } from '@/lib/utils'

// Profile chip + dropdown - Profile / Lock / Logout (screenshot + design_ref).
// Setup gate - Profile + Lock disabled; Logout always allowed.
export function UserMenu({ setupGate = false }) {
  const { t } = useTranslation()
  const { user, logout, lockSession, cashDrawerOpen } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  if (!user) return null

  // Logout: if the till is open, cashier must close it first.
  // During Sync / Open Session, there is no till — sign out directly.
  const handleLogout = async () => {
    if (!setupGate && cashDrawerOpen) {
      navigate(PATHS.closeCashDrawer)
      return
    }
    const result = await logout()
    if (!result.success) {
      // Server still has an open drawer (client flag was stale).
      if (result.status === 409) {
        navigate(PATHS.closeCashDrawer)
        return
      }
      toast.error(result.error || t('userMenu.logoutFailed'))
      return
    }
    navigate(PATHS.login, { replace: true })
  }

  // Lock session (POST /auth/lock)
  const handleLock = async () => {
    if (setupGate) return
    const result = await lockSession()
    if (result && !result.success) {
      toast.error(result.error || t('userMenu.lockFailed'))
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex cursor-pointer items-center gap-2 rounded-xl border border-transparent px-1.5 py-1 outline-none',
          'hover:bg-[var(--brand-soft)]/80 focus-visible:ring-2 focus-visible:ring-ring',
          'data-[popup-open]:bg-[var(--brand-soft)]',
        )}
      >
        <Avatar size="default" className="bg-primary text-primary-foreground">
          <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
            {user.initials}
          </AvatarFallback>
        </Avatar>
        <div className="hidden text-start sm:block">
          <p className="text-sm leading-tight font-semibold text-foreground">{user.name}</p>
          <p className="text-xs capitalize text-muted-foreground">{user.role}</p>
        </div>
        <ChevronDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-60 p-0">
        <div className="flex items-center gap-3 px-3 py-3">
          <Avatar className="size-11 bg-primary text-primary-foreground">
            <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
              {user.initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{user.name}</p>
            <p className="text-xs capitalize text-muted-foreground">{user.role}</p>
            <p className="text-xs font-medium text-primary">
              {user.email || user.userId || t('shared.emDash')}
            </p>
          </div>
        </div>

        <DropdownMenuSeparator className="m-0" />

        <div className="gap-6 p-1">
          {/* Dark / Light mode toggle */}
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
            {theme === 'dark' ? t('userMenu.lightMode') : t('userMenu.darkMode')}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={setupGate}
            className="cursor-pointer gap-2 data-disabled:cursor-not-allowed"
            onClick={() => {
              if (setupGate) return
              navigate(
                user.role === 'admin' ? PATHS.admin.profile : PATHS.profile,
              )
            }}
          >
            <User className="size-4" />
            {t('userMenu.profile')}
          </DropdownMenuItem>

          {/* —— Lock → SessionLockModal —— */}
          <DropdownMenuItem
            disabled={setupGate}
            className="cursor-pointer gap-2 data-disabled:cursor-not-allowed"
            onClick={handleLock}
          >
            <Lock className="size-4" />
            {t('userMenu.lock')}
          </DropdownMenuItem>

          <DropdownMenuItem
            variant="destructive"
            className="cursor-pointer gap-2"
            onClick={handleLogout}
          >
            <LogOut className="size-4" />
            {t('userMenu.logout')}
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
