import { useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useNotifications } from '@/hooks/useNotifications'
import PageHeader from '@/components/shared/PageHeader'
import EmptyState from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function NotificationsPage() {
  const { t } = useTranslation()
  const {
    notifications,
    clearAll,
    markAllRead,
    isLoading,
    isError,
    error,
  } = useNotifications()
  const markedRef = useRef(false)

  useEffect(() => {
    if (markedRef.current) return
    if (!notifications.length) return
    markedRef.current = true
    markAllRead()
  }, [notifications, markAllRead])

  // Handle clear
  const handleClear = async () => {
    const result = await clearAll()
    if (!result.success) toast.error(result.error)
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title={t('notificationsPage.title')}
        subtitle={t('notificationsPage.subtitle')}
        actions={
          <Button type="button" variant="outline" onClick={handleClear}>
            {t('notificationsPage.clearAll')}
          </Button>
        }
      />

      <Card className="border-border shadow-sm">
        <CardContent className="p-0">
          {isLoading && notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t('notificationsPage.loading')}
            </p>
          ) : isError ? (
            <p className="px-4 py-8 text-center text-sm text-destructive">
              {error?.error || t('notificationsPage.failedLoad')}
            </p>
          ) : notifications.length === 0 ? (
            <EmptyState message={t('notificationsPage.empty')} />
          ) : (
            <ul>
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className="border-b border-border px-4 py-3 last:border-b-0"
                >
                  <p className="text-sm text-foreground">{n.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format(n.at, 'd MMM yyyy, h:mm a')} ·{' '}
                    {n.type || t('notificationsPage.typeFallback')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
