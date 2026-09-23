import { Link, useLocation } from 'react-router-dom'
import {
  MapPin,
  ScrollText,
  Tags,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BrandLogo } from '@/components/shared/BrandLogo'
import { Badge } from '@/components/ui/badge'
import { NotificationBell } from '@/layouts/Navbar/NotificationBell'
import { LanguageSelect } from '@/layouts/Navbar/LanguageSelect'
import { UserMenu } from '@/layouts/Navbar/UserMenu'
import { PATHS } from '@/router/paths'
import { cn } from '@/lib/utils'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

// Admin topnav - logs / rates / cashiers / invoice details
export function AdminTopNav() {
  const { t } = useTranslation()
  const location = useLocation()
  const { isOnline } = useOnlineStatus()

  const tabs = [
    {
      to: PATHS.admin.logs,
      label: t('adminNav.activityLogs'),
      icon: ScrollText,
      match: (p) => p === PATHS.admin.logs || p.startsWith(`${PATHS.admin.logs}/`),
    },
    {
      to: PATHS.admin.items,
      label: t('adminNav.itemsRate'),
      icon: Tags,
      match: (p) => p.startsWith(PATHS.admin.items),
    },
    {
      to: PATHS.admin.cashiers,
      label: t('adminNav.cashiers'),
      icon: Users,
      match: (p) => p.startsWith(PATHS.admin.cashiers),
    },
    {
      to: PATHS.admin.invoiceDetails,
      label: t('adminNav.invoiceDetails'),
      icon: MapPin,
      match: (p) => p.startsWith(PATHS.admin.invoiceDetails),
    },
  ]

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-4 border-b border-border bg-card px-4 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <BrandLogo size="sm" />
        <nav
          className="flex min-w-0 items-center gap-0.5 overflow-x-auto"
          aria-label={t('adminNav.ariaAdmin')}
        >
          {tabs.map(({ to, label, icon: Icon, match }) => {
            const active = match(location.pathname)
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'inline-flex h-14 shrink-0 cursor-pointer items-center gap-2 border-b-2 px-2.5 text-sm font-medium transition-colors xl:px-3',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" />
                <span className="hidden md:inline">{label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <Badge
          variant="secondary"
          className={cn(
            'hidden h-7 gap-1.5 rounded-full border-0 px-3 sm:inline-flex',
            isOnline
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
              : 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400',
          )}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              isOnline ? 'bg-emerald-500' : 'bg-amber-500',
            )}
          />
          {isOnline ? t('adminNav.online') : t('adminNav.offline')}
        </Badge>
        <Badge
          variant="secondary"
          className="hidden h-7 gap-1.5 rounded-full border-0 bg-[var(--brand-soft)] px-3 text-primary sm:inline-flex dark:bg-[var(--brand-soft)] dark:text-primary"
        >
          <span className="size-1.5 rounded-full bg-primary" />
          {t('adminNav.adminBadge')}
        </Badge>
        <NotificationBell />
        <LanguageSelect />
        <UserMenu />
      </div>
    </header>
  )
}
