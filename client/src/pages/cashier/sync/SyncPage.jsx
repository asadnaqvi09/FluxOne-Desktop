import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CloudOff, Loader2, Upload } from 'lucide-react'
import { formatAppDateTime } from '@/api/result'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import { useSync } from '@/hooks/useSync'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { CTA_MIN_PENDING_MS, useMinPending } from '@/hooks/useMinPending'
import { PATHS } from '@/router/paths'
import { cn } from '@/lib/utils'

export default function SyncPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { syncOk, lastSyncedAt, runSync: authRunSync, cashDrawerOpen } = useAuth()
  const {
    bootstrapDone,
    cloudConfigured,
    pendingOutbox,
    failedOutbox,
    failedEvents,
    lastPullAt,
    lastPushAt,
    refreshStatus,
    isStatusLoading,
  } = useSync({ enablePolling: true, enableBackgroundSync: false })
  const { isOnline } = useOnlineStatus()
  const { pending: busy, run } = useMinPending(CTA_MIN_PENDING_MS)
  const [error, setError] = useState('')

  // After session sync: Cash Drawer next; if drawer already open → POS
  useEffect(() => {
    if (!syncOk || busy) return
    if (cashDrawerOpen && pendingOutbox === 0) {
      navigate(PATHS.pos, { replace: true })
      return
    }
    if (!cashDrawerOpen) {
      navigate(PATHS.openCashDrawer, { replace: true })
    }
  }, [syncOk, cashDrawerOpen, pendingOutbox, busy, navigate])

  const needsOnlineBootstrap = !bootstrapDone
  const uploadPending = pendingOutbox > 0
  const hasFailures = failedOutbox > 0
  // After first successful session sync, block repeat Sync Now unless queue/failures need it
  const needsAnotherSync = !syncOk || uploadPending || hasFailures
  const canSyncNow =
    !busy &&
    needsAnotherSync &&
    (bootstrapDone || (isOnline && cloudConfigured))

  const handleSync = async () => {
    setError('')
    const result = await run(async () => authRunSync())
    if (result && !result.success) {
      setError(result.error)
      return
    }
    await refreshStatus()
    // Navigation to cash drawer is handled by the syncOk effect above
  }

  const handleOpenSession = () => {
    if (!syncOk || busy) return
    navigate(PATHS.openCashDrawer)
  }

  const displayLastSync = lastPullAt || lastSyncedAt
  const syncBusyLabel = uploadPending
    ? t('syncPage.uploadingSales')
    : t('syncPage.pullingCatalog')
  const cloudSynced =
    bootstrapDone && isOnline && !uploadPending && !hasFailures && syncOk

  return (
    <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-4 py-10 sm:items-center">
      <Card className="w-full max-w-lg rounded-2xl border-border bg-card py-0 shadow-[var(--app-shadow)]">
        <CardContent className="space-y-6 p-8 sm:p-10">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">
            {t('syncPage.stepEyebrow')}
          </p>

          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-[1.75rem]">
              {t('syncPage.title')}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {needsOnlineBootstrap
                ? t('syncPage.subtitleBootstrap')
                : t('syncPage.subtitleReady')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
                cloudSynced
                  ? 'bg-emerald-50 text-emerald-700'
                  : uploadPending
                    ? 'bg-amber-50 text-amber-800'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  cloudSynced
                    ? 'bg-emerald-500'
                    : uploadPending
                      ? 'bg-amber-500'
                      : 'bg-muted-foreground',
                )}
              />
              {cloudSynced
                ? t('syncPage.cloudSynced')
                : uploadPending
                  ? t('syncPage.queuedForCloud')
                  : syncOk
                    ? t('syncPage.cachedReady')
                    : t('syncPage.syncRequired')}
            </span>

            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
                isOnline
                  ? 'bg-sky-50 text-sky-800'
                  : 'bg-amber-50 text-amber-800',
              )}
            >
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  isOnline ? 'bg-sky-500' : 'bg-amber-500',
                )}
              />
              {isOnline ? t('syncPage.online') : t('syncPage.offline')}
            </span>

            {bootstrapDone ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                {t('syncPage.bootstrapComplete')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                {t('syncPage.bootstrapPending')}
              </span>
            )}
          </div>

          <div className="grid gap-3 rounded-xl border border-border/80 bg-muted/30 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t('syncPage.lastCatalogPull')}</span>
              <span className="font-medium text-foreground">
                {displayLastSync
                  ? formatAppDateTime(displayLastSync, t('shared.emDash'))
                  : t('shared.emDash')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t('syncPage.lastCloudPush')}</span>
              <span className="font-medium text-foreground">
                {lastPushAt
                  ? formatAppDateTime(lastPushAt, t('shared.emDash'))
                  : t('shared.emDash')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t('syncPage.pendingUpload')}</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 font-medium',
                  uploadPending ? 'text-amber-800' : 'text-foreground',
                )}
              >
                {uploadPending ? <Upload className="size-3.5" /> : null}
                {pendingOutbox}
              </span>
            </div>
            {hasFailures ? (
              <div className="space-y-2 text-destructive">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5" />
                    {t('syncPage.failedEvents')}
                  </span>
                  <span className="font-medium">{failedOutbox}</span>
                </div>
                {/* DEV: remove failedEvents detail before client delivery */}
                <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-foreground">
                  {(failedEvents || []).map((row) => (
                    <li key={row.clientEventId} className="space-y-1 border-b border-border/40 pb-2 last:border-0 last:pb-0">
                      <p className="font-semibold text-destructive">
                        {row.eventType}
                        {row.saleNumber ? ` · ${row.saleNumber}` : ''}
                        {row.retryCount > 0
                          ? ` · ${t('syncPage.retryCount', { count: row.retryCount })}`
                          : ''}
                      </p>
                      <p className="break-words text-muted-foreground">{row.lastError}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {isStatusLoading ? (
              <p className="text-xs text-muted-foreground">
                {t('syncPage.refreshingStatus')}
              </p>
            ) : null}
          </div>

          {!bootstrapDone && !cloudConfigured ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t('syncPage.cloudSetupIncomplete')}
            </p>
          ) : null}

          {!isOnline && bootstrapDone ? (
            <p className="inline-flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <CloudOff className="mt-0.5 size-4 shrink-0" />
              {uploadPending
                ? t('syncPage.offlineWithQueue', { count: pendingOutbox })
                : t('syncPage.offlineCached')}
            </p>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            {syncOk && !needsAnotherSync ? (
              <Button
                type="button"
                onClick={handleOpenSession}
                disabled={busy}
                className="h-11 flex-1 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {t('syncPage.continueCashDrawer')}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  onClick={handleSync}
                  disabled={!canSyncNow}
                  className="h-11 flex-1 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {busy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {syncBusyLabel}
                    </>
                  ) : (
                    t('syncPage.syncNow')
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenSession}
                  disabled={!syncOk || busy}
                  className={cn(
                    'h-11 flex-1 cursor-pointer',
                    syncOk && !busy
                      ? 'border-primary/30 text-primary hover:bg-[var(--brand-soft)]'
                      : 'text-muted-foreground',
                  )}
                >
                  {t('syncPage.continueCashDrawer')}
                </Button>
              </>
            )}
          </div>

          <p className="text-sm text-muted-foreground">{t('syncPage.footerHint')}</p>
        </CardContent>
      </Card>
    </div>
  )
}
