import { useCallback, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { formatAppDateTime } from '@/api/result'
import { useAuth } from '@/context/AuthContext'
import { useSync } from '@/hooks/useSync'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { cn } from '@/lib/utils'

function formatRelativeCount(count, overflowLabel) {
  const n = Number(count) || 0
  if (n <= 0) return ''
  return n > 99 ? overflowLabel : String(n)
}

const PENDING_TYPE_KEYS = [
  { key: 'sale', plural: 'sales', singular: 'sale' },
  { key: 'refund', plural: 'refunds', singular: 'refund' },
  { key: 'product_price_update', plural: 'priceUpdates', singular: 'priceUpdate' },
  { key: 'cashier_log', plural: 'cashierLogs', singular: 'cashierLog' },
  { key: 'attendance', plural: 'attendancePlural', singular: 'attendance' },
]

function buildPendingLines(pendingByType = {}, t) {
  return PENDING_TYPE_KEYS.map(({ key, plural, singular }) => {
    const count = Number(pendingByType?.[key]) || 0
    if (count <= 0) return null
    return {
      key,
      count,
      label: t(
        count === 1
          ? `syncBadge.pendingTypes.${singular}`
          : `syncBadge.pendingTypes.${plural}`,
      ),
    }
  }).filter(Boolean)
}

// Sync status pill — synced, pending upload, cached/offline, or setup required.
export function SyncBadge() {
  const { t } = useTranslation()
  const { syncOk, lastSyncedAt, runSync } = useAuth()
  const {
    pendingOutbox,
    failedOutbox,
    failedEvents,
    pendingByType,
    lastPullAt,
    lastPushAt,
    bootstrapDone,
    refreshStatus,
    isLoading,
  } = useSync({
    enablePolling: false,
    enableBackgroundSync: false,
  })
  const { isOnline } = useOnlineStatus()
  const [syncing, setSyncing] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const displayLastSync = lastPullAt || lastSyncedAt
  const pendingLabel = formatRelativeCount(
    pendingOutbox,
    t('syncBadge.countOverflow'),
  )
  const hasPending = pendingOutbox > 0
  const hasFailures = failedOutbox > 0
  const busy = syncing || isLoading
  const canSync = bootstrapDone && isOnline && !busy
  const pendingLines = useMemo(
    () => buildPendingLines(pendingByType, t),
    [pendingByType, t],
  )

  const handleSync = useCallback(async () => {
    if (!canSync) return
    setSyncing(true)
    try {
      await runSync()
      await refreshStatus()
    } finally {
      setSyncing(false)
    }
  }, [canSync, runSync, refreshStatus])

  const handleMouseEnter = useCallback(() => {
    setDetailsOpen(true)
    if (bootstrapDone) {
      refreshStatus()
    }
  }, [bootstrapDone, refreshStatus])

  const handleMouseLeave = useCallback(() => {
    setDetailsOpen(false)
  }, [])

  let label = t('syncBadge.cachedData')
  let tone = 'amber'

  if (busy) {
    label = t('syncBadge.syncing')
    tone = 'amber'
  } else if (!bootstrapDone) {
    label = t('syncBadge.setupRequired')
    tone = 'amber'
  } else if (hasFailures) {
    label = pendingLabel
      ? t('syncBadge.syncIssuesWithCount', { count: pendingLabel })
      : t('syncBadge.syncIssues')
    tone = 'red'
  } else if (hasPending) {
    label = pendingLabel
      ? t('syncBadge.pendingWithCount', { count: pendingLabel })
      : t('syncBadge.pendingUpload')
    tone = 'amber'
  } else if (syncOk && isOnline) {
    label = t('syncBadge.synced')
    tone = 'green'
  } else if (syncOk) {
    label = t('syncBadge.cachedReady')
    tone = 'green'
  } else if (bootstrapDone) {
    label = t('syncBadge.cachedData')
    tone = 'amber'
  }

  const toneClasses = {
    green:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
    amber:
      'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400',
    red: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
  }

  const dotClasses = {
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  }

  const showPendingDetails = detailsOpen && (hasPending || hasFailures)

  const content = (
    <>
      {busy ? (
        <Loader2 className="size-3 shrink-0 animate-spin" />
      ) : (
        <span className={cn('size-1.5 shrink-0 rounded-full', dotClasses[tone])} />
      )}
      <span className="truncate">{label}</span>
    </>
  )

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      <Badge
        variant="secondary"
        className={cn(
          'h-7 max-w-[11rem] gap-1.5 truncate rounded-full border-0 px-3',
          toneClasses[tone],
          canSync ? 'cursor-pointer hover:opacity-90' : 'cursor-default',
        )}
        render={
          canSync ? (
            <button
              type="button"
              onClick={handleSync}
              aria-label={
                hasPending
                  ? t('syncBadge.ariaSyncNowPending', { count: pendingOutbox })
                  : t('syncBadge.ariaSyncNow')
              }
              className="inline-flex min-w-0 items-center gap-1.5"
            />
          ) : undefined
        }
      >
        {content}
      </Badge>

      {showPendingDetails ? (
        <div
          role="tooltip"
          className="absolute end-0 top-full z-50 mt-2 w-80 rounded-lg border border-border/60 bg-popover p-3 text-start text-xs text-popover-foreground shadow-md"
        >
          <p className="font-medium text-foreground">{t('syncBadge.tooltipTitle')}</p>
          {pendingLines.length > 0 ? (
            <ul className="mt-2 space-y-1 text-muted-foreground">
              {pendingLines.map((line) => (
                <li key={line.key} className="flex items-center justify-between gap-3">
                  <span>{line.label}</span>
                  <span className="font-medium tabular-nums text-foreground">{line.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-muted-foreground">
              {t('syncBadge.queuedEvents', { count: pendingOutbox })}
            </p>
          )}
          {hasFailures ? (
            <div className="mt-2 space-y-2">
              <p className="text-red-600 dark:text-red-400">
                {t('syncBadge.failedUploads', { count: failedOutbox })}
              </p>
              {/* DEV: remove failedEvents detail before client delivery */}
              <ul className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-red-200/80 bg-red-50/80 p-2 text-[11px] text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                {(failedEvents || []).slice(0, 5).map((row) => (
                  <li key={row.clientEventId} className="space-y-0.5">
                    <p className="font-semibold">
                      {row.eventType}
                      {row.saleNumber ? ` · ${row.saleNumber}` : ''}
                    </p>
                    <p className="break-words leading-snug">{row.lastError}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-2 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
            <p>{t('syncBadge.totalPending', { count: pendingOutbox })}</p>
            {lastPushAt ? (
              <p>{t('syncBadge.lastPush', { datetime: formatAppDateTime(lastPushAt) })}</p>
            ) : null}
            {displayLastSync ? (
              <p>
                {t('syncBadge.lastPull', {
                  datetime: formatAppDateTime(displayLastSync),
                })}
              </p>
            ) : null}
            {canSync ? (
              <p className="mt-1 text-foreground/80">{t('syncBadge.clickToSync')}</p>
            ) : null}
            {!isOnline ? (
              <p className="mt-1">{t('syncBadge.offlineUploads')}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
