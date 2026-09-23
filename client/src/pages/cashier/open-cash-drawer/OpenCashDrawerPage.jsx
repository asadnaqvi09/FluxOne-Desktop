import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { CTA_MIN_PENDING_MS, useMinPending } from '@/hooks/useMinPending'
import { PATHS } from '@/router/paths'

export default function OpenCashDrawerPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { openCashDrawer, syncOk, cashDrawerOpen, cashierFunnelNeedsSync } = useAuth()
  const [floatAmount, setFloatAmount] = useState('5,000')
  const [error, setError] = useState('')
  const { pending: busy, run } = useMinPending(CTA_MIN_PENDING_MS)

  useEffect(() => {
    if (!syncOk) navigate(PATHS.sync, { replace: true })
  }, [syncOk, navigate])

  useEffect(() => {
    if (cashDrawerOpen) navigate(PATHS.pos, { replace: true })
  }, [cashDrawerOpen, navigate])

  const handleConfirm = async () => {
    setError('')
    const result = await run(async () => openCashDrawer(floatAmount))
    if (!result?.success) {
      setError(result?.error || t('openCashDrawer.failedOpen'))
      return
    }
    navigate(PATHS.pos, { replace: true })
  }

  const handleBack = () => {
    navigate(PATHS.sync)
  }

  const stepEyebrow = cashierFunnelNeedsSync
    ? t('openCashDrawer.stepEyebrowWithSync')
    : t('openCashDrawer.stepEyebrowSolo')

  return (
    <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-4 py-10 sm:items-center">
      <Card className="w-full max-w-lg rounded-2xl border-border bg-card py-0 shadow-[var(--app-shadow)]">
        <CardContent className="space-y-6 p-8 sm:p-10">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">
            {stepEyebrow}
          </p>

          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-[1.75rem]">
              {t('openCashDrawer.title')}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('openCashDrawer.subtitle')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="opening-float" className="font-semibold">
              {t('openCashDrawer.floatLabel')}
            </Label>
            <Input
              id="opening-float"
              type="text"
              inputMode="decimal"
              value={floatAmount}
              onChange={(e) => setFloatAmount(e.target.value)}
              className="h-11"
              placeholder={t('openCashDrawer.floatPlaceholder')}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={busy}
              className="h-11 flex-1 cursor-pointer bg-gradient-to-r from-primary to-[var(--brand-deep)] text-primary-foreground hover:opacity-95"
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('openCashDrawer.opening')}
                </>
              ) : (
                t('openCashDrawer.confirmOpen')
              )}
            </Button>

            {cashierFunnelNeedsSync ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={busy}
                className="h-11 flex-1 cursor-pointer border-border text-primary hover:bg-[var(--brand-soft)]"
              >
                {t('openCashDrawer.backToSync')}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
