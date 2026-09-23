import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

// Cash drawer session pill - shows SES-id when open (matches design screenshots)
export function SessionBadge() {
  const { t } = useTranslation()
  const { cashDrawerOpen, sessionId } = useAuth()
  return (
    <Badge
      variant="secondary"
      className={cn(
        'h-7 gap-1.5 rounded-full border-0 px-3',
        cashDrawerOpen
          ? 'bg-[var(--brand-soft)] text-primary'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {cashDrawerOpen ? (
        <>
          <span className="size-1.5 rounded-full bg-primary" />
          {t('sessionBadge.open', {
            sessionId: sessionId || t('sessionBadge.openFallbackId'),
          })}
        </>
      ) : (
        t('sessionBadge.closed')
      )}
    </Badge>
  )
}
