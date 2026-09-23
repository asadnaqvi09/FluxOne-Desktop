import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useNotifications } from '@/hooks/useNotifications'
import { PATHS } from '@/router/paths'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

// Notifications bell + dropdown - GET /notifications.
export function NotificationBell({ locked = false }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    notifications,
    unreadCount,
    clearAll,
    markAllRead,
    isLoading,
  } = useNotifications({ skip: locked || !user })

  const preview = notifications.slice(0, 8)

  if (locked) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled
        className="size-9 cursor-not-allowed rounded-lg"
        title={t('notificationsBell.lockedTitle')}
        aria-label={t('notificationsBell.ariaLabel')}
      >
        <Bell className="size-5" />
      </Button>
    )
  }

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) markAllRead()
      }}
    >
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: 'outline', size: 'icon' }),
          'relative size-9 cursor-pointer rounded-lg',
        )}
        title={t('notificationsBell.title')}
        aria-label={t('notificationsBell.ariaLabel')}
      >
        <Bell className="size-5" />
        {unreadCount > 0 ? (
          <span className="absolute top-1.5 end-1.5 size-2 rounded-full bg-primary" />
        ) : null}
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-80 gap-0 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <strong className="text-sm font-bold text-foreground">
            {t('notificationsBell.title')}
          </strong>
          <button
            type="button"
            className="cursor-pointer text-sm font-medium text-primary hover:underline"
            onClick={async () => {
              const result = await clearAll()
              if (!result.success) toast.error(result.error)
            }}
          >
            {t('notificationsBell.clear')}
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto">
          {isLoading && preview.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t('notificationsBell.loading')}
            </p>
          ) : preview.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t('notificationsBell.empty')}
            </p>
          ) : (
            preview.map((n) => (
              <div
                key={n.id}
                className="border-b border-border/70 px-3 py-2.5 last:border-b-0"
              >
                <p className="text-sm leading-snug text-foreground">{n.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {format(n.at, 'd MMM yyyy, h:mm a')} ·{' '}
                  {n.type || t('notificationsBell.typeFallback')}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border p-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 w-full cursor-pointer text-primary"
            onClick={() =>
              navigate(
                user?.role === 'admin'
                  ? PATHS.admin.notifications
                  : PATHS.notifications,
              )
            }
          >
            {t('notificationsBell.viewAll')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
