import { Link, useLocation } from 'react-router-dom'
import { FileText, ShoppingCart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BrandLogo } from '@/components/shared/BrandLogo'
import { useAuth } from '@/context/AuthContext'
import { PATHS } from '@/router/paths'
import { cn } from '@/lib/utils'
import { formatAppDateTime } from '@/api/result'
import { SyncBadge } from '@/layouts/Navbar/SyncBadge'
import { SessionBadge } from '@/layouts/Navbar/SessionBadge'
import { NotificationBell } from '@/layouts/Navbar/NotificationBell'
import { LanguageSelect } from '@/layouts/Navbar/LanguageSelect'
import { UserMenu } from '@/layouts/Navbar/UserMenu'

// Cashier topnav — POS | Invoice stay locked until Sync AND Open Cash Drawer are done.
export function TopNav() {
  const { t } = useTranslation()
  const { canAccessPos, syncOk, lastSyncedAt } = useAuth()
  const location = useLocation()
  const setupGate = !canAccessPos

  const tabs = [
    {
      to: PATHS.pos,
      label: t('nav.pos'),
      icon: ShoppingCart,
      match: (p) => p === PATHS.pos || p.startsWith(`${PATHS.pos}/`),
    },
    {
      to: PATHS.invoices,
      label: t('nav.invoice'),
      icon: FileText,
      match: (p) => p === PATHS.invoices || p.startsWith(`${PATHS.invoices}/`),
    },
  ]

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-4 border-b border-border bg-card px-4 shadow-sm">
      <div className="flex min-w-0 items-center gap-4">
        <BrandLogo size="sm" />

        <nav className="flex items-center gap-1" aria-label={t('nav.ariaCashier')}>
          {tabs.map(({ to, label, icon: Icon, match }) => {
            // Screenshot: POS stays visually active during Sync / Open Cash Drawer setup
            const active = setupGate
              ? to === PATHS.pos
              : match(location.pathname)

            if (setupGate) {
              return (
                <button
                  key={to}
                  type="button"
                  disabled
                  title={t('nav.setupGateTitle')}
                  className={cn(
                    'inline-flex h-14 cursor-not-allowed items-center gap-2 border-b-2 px-3 text-sm font-medium',
                    active
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground opacity-70',
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              )
            }

            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'inline-flex h-14 cursor-pointer items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <SyncBadge />
        <SessionBadge />
        <span className="sr-only">
          {syncOk && lastSyncedAt
            ? t('nav.lastSynced', { datetime: formatAppDateTime(lastSyncedAt) })
            : t('nav.notSynced')}
        </span>
        <NotificationBell locked={setupGate} />
        <LanguageSelect locked={setupGate} />
        <UserMenu setupGate={setupGate} />
      </div>
    </header>
  )
}
