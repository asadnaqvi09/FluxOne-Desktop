import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Cloud, Loader2 } from 'lucide-react'
import { ENDPOINTS } from '@/api/endpoints'
import { apiRequest } from '@/api/apiHelper'
import { BrandLogo } from '@/components/shared/BrandLogo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { CTA_MIN_PENDING_MS, useMinPending } from '@/hooks/useMinPending'
import { cn } from '@/lib/utils'
import { PATHS } from '@/router/paths'
import { LanguageSelect } from '@/layouts/Navbar/LanguageSelect'

const DEFAULT_CLOUD_URL = 'https://fluxone-b2b.onrender.com'

export default function SetupWizardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isOnline } = useOnlineStatus()
  const { pending: busy, run } = useMinPending(CTA_MIN_PENDING_MS)

  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)

  const [cloudApiUrl, setCloudApiUrl] = useState(DEFAULT_CLOUD_URL)
  const [deviceId, setDeviceId] = useState('')
  const [cloudId, setCloudId] = useState('')
  const [cloudPassword, setCloudPassword] = useState('')
  const [branchId, setBranchId] = useState('')
  const [branchName, setBranchName] = useState('')
  const [bootstrapCounts, setBootstrapCounts] = useState(null)

  const steps = useMemo(
    () => [
      { id: 1, label: t('setup.stepCloudUrl') },
      { id: 2, label: t('setup.stepBranchManager') },
      { id: 3, label: t('setup.stepActivate') },
    ],
    [t],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const status = await apiRequest(ENDPOINTS.setup.status)
        if (cancelled) return
        if (status?.bootstrapDone) {
          navigate(PATHS.login, { replace: true })
          return
        }
        if (status?.cloudApiUrl) setCloudApiUrl(status.cloudApiUrl.replace(/\/api\/?$/, ''))
        if (status?.deviceId) setDeviceId(status.deviceId)
        if (status?.branchId) setBranchId(status.branchId)
      } catch {
        // First boot — stay on wizard
      } finally {
        if (!cancelled) setChecking(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [navigate])

  const handleConfigure = async () => {
    setError('')
    const result = await run(async () =>
      apiRequest(ENDPOINTS.setup.configure, {
        method: 'POST',
        body: { cloudApiUrl },
      }),
    )
    if (!result) {
      setError(t('setup.failedSaveCloudUrl'))
      return
    }
    setDeviceId(result.deviceId || deviceId)
    setStep(2)
  }

  const handleCloudLogin = async () => {
    setError('')
    if (!isOnline) {
      setError(t('setup.internetRequiredLogin'))
      return
    }
    try {
      const result = await run(async () =>
        apiRequest(ENDPOINTS.setup.login, {
          method: 'POST',
          body: { id: cloudId, password: cloudPassword },
        }),
      )
      const resolvedBranchId =
        result?.autoSelectedBranchId ??
        result?.branchId ??
        result?.branches?.[0]?.id ??
        null
      if (!resolvedBranchId) {
        setError(t('setup.couldNotResolveBranch'))
        return
      }
      setBranchId(resolvedBranchId)
      setBranchName(
        result?.branchName ??
          result?.branches?.find((branch) => branch.id === resolvedBranchId)?.name ??
          resolvedBranchId,
      )
      setStep(3)
    } catch (err) {
      setError(err?.message || t('setup.cloudLoginFailed'))
    }
  }

  const handleBootstrap = async () => {
    setError('')
    if (!isOnline) {
      setError(t('setup.internetRequiredDownload'))
      return
    }
    try {
      const result = await run(async () =>
        apiRequest(ENDPOINTS.setup.bootstrap, {
          method: 'POST',
          body: { branchId },
        }),
      )
      setBootstrapCounts(result?.bootstrap ?? null)
      setDeviceId(result?.deviceId || deviceId)
    } catch (err) {
      setError(err?.message || t('setup.bootstrapFailed'))
    }
  }

  const goToLogin = useCallback(() => {
    navigate(PATHS.login, { replace: true })
  }, [navigate])

  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="me-2 size-4 animate-spin" />
        {t('setup.checkingStatus')}
      </div>
    )
  }

  const downloadedSummary =
    bootstrapCounts?.sales != null
      ? t('setup.downloadedSummaryWithSales', {
          products: bootstrapCounts.products ?? 0,
          users: bootstrapCounts.users ?? 0,
          categories: bootstrapCounts.categories ?? 0,
          sales: bootstrapCounts.sales,
        })
      : t('setup.downloadedSummary', {
          products: bootstrapCounts?.products ?? 0,
          users: bootstrapCounts?.users ?? 0,
          categories: bootstrapCounts?.categories ?? 0,
        })

  return (
    <section className="auth-screen relative flex min-h-dvh items-center justify-center p-6">
      <div className="absolute top-4 end-4">
        <LanguageSelect />
      </div>

      <Card className="w-full max-w-xl rounded-2xl border-border bg-card py-0 shadow-[var(--app-shadow)]">
        <CardContent className="space-y-6 p-8 sm:p-10">
          <div className="text-center">
            <BrandLogo size="md" className="mx-auto mb-3" />
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">
              {t('setup.eyebrow')}
            </p>
            <h1 className="mt-2 text-2xl font-bold text-foreground">
              {t('setup.title')}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{t('setup.subtitle')}</p>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {steps.map((item) => (
              <span
                key={item.id}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium',
                  step === item.id
                    ? 'bg-primary text-primary-foreground'
                    : step > item.id
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {item.label}
              </span>
            ))}
          </div>

          {deviceId ? (
            <p className="text-center text-xs text-muted-foreground">
              {t('setup.deviceId', { deviceId })}
            </p>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cloudApiUrl">{t('setup.cloudApiUrlLabel')}</Label>
                <Input
                  id="cloudApiUrl"
                  value={cloudApiUrl}
                  onChange={(e) => setCloudApiUrl(e.target.value)}
                  placeholder={t('setup.cloudApiUrlPlaceholder')}
                  className="h-11"
                  disabled
                  readOnly
                />
                <p className="text-xs text-muted-foreground">{t('setup.cloudApiUrlHint')}</p>
              </div>
              <Button
                type="button"
                className="h-11 w-full"
                disabled={busy || !cloudApiUrl.trim()}
                onClick={handleConfigure}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : t('setup.saveContinue')}
              </Button>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                <Cloud className="size-4 text-primary" />
                <span className="truncate text-muted-foreground">{cloudApiUrl}</span>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cloudId">{t('setup.branchManagerLoginId')}</Label>
                <Input
                  id="cloudId"
                  value={cloudId}
                  onChange={(e) => setCloudId(e.target.value)}
                  placeholder={t('setup.branchManagerPlaceholder')}
                  className="h-11"
                  autoComplete="username"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cloudPassword">{t('setup.passwordLabel')}</Label>
                <Input
                  id="cloudPassword"
                  type="password"
                  value={cloudPassword}
                  onChange={(e) => setCloudPassword(e.target.value)}
                  placeholder={t('setup.passwordPlaceholder')}
                  className="h-11"
                  autoComplete="current-password"
                />
              </div>
              <p className="text-xs text-muted-foreground">{t('setup.branchManagerHint')}</p>
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="h-11" onClick={() => setStep(1)}>
                  {t('setup.back')}
                </Button>
                <Button
                  type="button"
                  className="h-11 flex-1"
                  disabled={busy || !isOnline || !cloudId || !cloudPassword}
                  onClick={handleCloudLogin}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : t('setup.signIn')}
                </Button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              {bootstrapCounts ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-center">
                  <CheckCircle2 className="mx-auto mb-2 size-8 text-emerald-600" />
                  <p className="font-semibold text-emerald-800">
                    {t('setup.terminalActivated')}
                  </p>
                  <p className="mt-1 text-sm text-emerald-700">{downloadedSummary}</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">{t('setup.activateBlurb')}</p>
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                    {t('setup.branch')}{' '}
                    <span className="font-medium text-foreground">{branchName || branchId}</span>
                  </div>
                  <Button
                    type="button"
                    className="h-11 w-full"
                    disabled={busy || !isOnline || !branchId}
                    onClick={handleBootstrap}
                  >
                    {busy ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {t('setup.downloading')}
                      </>
                    ) : (
                      t('setup.downloadActivate')
                    )}
                  </Button>
                </>
              )}

              {bootstrapCounts ? (
                <Button type="button" className="h-11 w-full" onClick={goToLogin}>
                  {t('setup.continueToLogin')}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full"
                  onClick={() => setStep(2)}
                >
                  {t('setup.back')}
                </Button>
              )}
            </div>
          ) : null}

          <div className="flex items-center justify-center gap-2 text-xs">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium',
                isOnline ? 'bg-sky-50 text-sky-800' : 'bg-amber-50 text-amber-800',
              )}
            >
              <span
                className={cn('size-1.5 rounded-full', isOnline ? 'bg-sky-500' : 'bg-amber-500')}
              />
              {isOnline ? t('setup.online') : t('setup.offline')}
            </span>
          </div>

          {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
    </section>
  )
}
