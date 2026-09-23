import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { useCashDrawer } from '@/hooks/useCashDrawer'
import { CTA_MIN_PENDING_MS, useMinPending } from '@/hooks/useMinPending'
import { formatMoney, parseMoneyInput } from '@/lib/formatCurrency'
import { VARIANCE_PIN_THRESHOLD } from '@/lib/constants'
import { PATHS } from '@/router/paths'

export default function CloseCashDrawerPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { logout, closeCashDrawer, cashDrawerOpen, sessionId } = useAuth()
  const { expected, isExpectedLoading, isClosing } = useCashDrawer()

  const [countedCash, setCountedCash] = useState('')
  const [remarks, setRemarks] = useState('')
  const [managerPassword, setManagerPassword] = useState('')
  const [error, setError] = useState('')
  const { pending: busy, run } = useMinPending(CTA_MIN_PENDING_MS)
  const closingToLoginRef = useRef(false)

  useEffect(() => {
    if (!cashDrawerOpen && !busy && !closingToLoginRef.current) {
      navigate(PATHS.openCashDrawer, { replace: true })
    }
  }, [cashDrawerOpen, busy, navigate])

  const expectedCash = Number(expected?.expectedCash) || 0
  const counted = countedCash === '' ? null : parseMoneyInput(countedCash)

  const fillExact = () => {
    setCountedCash(String(expectedCash))
  }

  const variance = useMemo(() => {
    if (counted === null || Number.isNaN(counted)) return null
    return Number((counted - expectedCash).toFixed(2))
  }, [counted, expectedCash])

  const needsRemarks = variance !== null && variance !== 0
  const needsManagerPassword =
    variance !== null && Math.abs(variance) > VARIANCE_PIN_THRESHOLD

  const handleConfirm = async () => {
    setError('')
    if (counted === null || Number.isNaN(counted) || counted < 0) {
      setError(t('closeCashDrawer.invalidCounted'))
      return
    }
    if (needsRemarks && !String(remarks).trim()) {
      setError(t('closeCashDrawer.remarksWhenVariance'))
      return
    }
    if (needsManagerPassword && !String(managerPassword).trim()) {
      setError(
        t('closeCashDrawer.managerPasswordWhenVariance', {
          threshold: VARIANCE_PIN_THRESHOLD,
        }),
      )
      return
    }

    const outcome = await run(async () => {
      const result = await closeCashDrawer({
        countedCash: counted,
        remarks: String(remarks).trim() || undefined,
        managerPassword: needsManagerPassword
          ? String(managerPassword).trim()
          : undefined,
      })
      if (!result.success) {
        return {
          ok: false,
          code: result.code,
          error: result.error || t('closeCashDrawer.failedClose'),
        }
      }
      const out = await logout()
      return {
        ok: true,
        logoutOk: out.success,
        logoutError: out.error,
      }
    })

    if (!outcome?.ok) {
      const noDrawer =
        outcome?.code === 'CASH_DRAWER_CLOSED' ||
        String(outcome?.error || '').toLowerCase().includes('no open cash drawer')
      if (noDrawer) {
        setError(t('closeCashDrawer.noDrawerOpen'))
        return
      }
      setError(
        outcome?.code === 'CARTS_NOT_EMPTY'
          ? t('closeCashDrawer.cartsNotEmpty')
          : outcome?.error || t('closeCashDrawer.failedClose'),
      )
      return
    }

    closingToLoginRef.current = true
    toast.success(t('closeCashDrawer.toastClosed'))
    if (!outcome.logoutOk) {
      toast.error(outcome.logoutError || t('closeCashDrawer.logoutFailedAfterClose'))
    }
    navigate(PATHS.login, { replace: true })
  }

  const handleCancel = () => {
    navigate(cashDrawerOpen ? PATHS.pos : PATHS.openCashDrawer)
  }

  const handleSignOutAnyway = async () => {
    closingToLoginRef.current = true
    const result = await logout()
    if (!result.success) {
      closingToLoginRef.current = false
      toast.error(result.error || t('closeCashDrawer.logoutFailed'))
      return
    }
    navigate(PATHS.login, { replace: true })
  }

  const noDrawerOpen =
    error === t('closeCashDrawer.noDrawerOpen') ||
    String(error).toLowerCase().includes('no cash drawer is open')

  if (!cashDrawerOpen && !busy && !closingToLoginRef.current) return null

  return (
    <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-4 py-10 sm:items-center">
      <Card className="w-full max-w-lg rounded-2xl border-border bg-card py-0 shadow-[var(--app-shadow)]">
        <CardContent className="space-y-6 p-8 sm:p-10">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">
            {t('closeCashDrawer.eyebrow')}
          </p>

          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-[1.75rem]">
              {t('closeCashDrawer.title')}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('closeCashDrawer.subtitle')}
              {sessionId ? (
                <>
                  {' '}
                  {t('closeCashDrawer.sessionSuffix', { sessionId })}
                </>
              ) : null}
            </p>
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-4 text-sm">
            {isExpectedLoading && !expected ? (
              <p className="text-muted-foreground">
                {t('closeCashDrawer.loadingExpected')}
              </p>
            ) : (
              <>
                <BreakdownRow
                  label={t('closeCashDrawer.openingFloat')}
                  value={expected?.openingFloat}
                />
                <BreakdownRow
                  label={t('closeCashDrawer.cashSales')}
                  value={expected?.saleIn}
                />
                <BreakdownRow
                  label={t('closeCashDrawer.cashRefunds')}
                  value={expected?.refundOut}
                />
                <div className="flex items-center justify-between border-t border-border pt-2 font-semibold">
                  <span>{t('closeCashDrawer.expectedInDrawer')}</span>
                  <span>{formatMoney(expectedCash)}</span>
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="counted-cash" className="font-semibold">
                {t('closeCashDrawer.countedCashLabel')}
              </Label>
              {expected ? (
                <button
                  type="button"
                  onClick={fillExact}
                  className="cursor-pointer text-xs font-semibold text-primary hover:underline"
                >
                  {t('closeCashDrawer.exactAmount')}
                </button>
              ) : null}
            </div>
            <Input
              id="counted-cash"
              type="text"
              inputMode="decimal"
              value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)}
              className="h-11"
              placeholder={t('closeCashDrawer.countedPlaceholder')}
            />
          </div>

          {variance !== null ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t('closeCashDrawer.variance')}
              </span>
              <strong
                className={
                  variance === 0
                    ? 'text-foreground'
                    : variance > 0
                      ? 'text-emerald-700'
                      : 'text-destructive'
                }
              >
                {formatMoney(variance)}
              </strong>
            </div>
          ) : null}

          {needsRemarks ? (
            <div className="space-y-2">
              <Label htmlFor="variance-remarks" className="font-semibold">
                {t('closeCashDrawer.remarksRequired')}
              </Label>
              <Input
                id="variance-remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="h-11"
                placeholder={t('closeCashDrawer.remarksPlaceholder')}
              />
            </div>
          ) : null}

          {needsManagerPassword ? (
            <div className="space-y-2">
              <Label htmlFor="manager-password" className="font-semibold">
                {t('closeCashDrawer.managerPasswordRequired')}
              </Label>
              <Input
                id="manager-password"
                type="password"
                value={managerPassword}
                onChange={(e) => setManagerPassword(e.target.value)}
                className="h-11"
                placeholder={t('closeCashDrawer.managerPasswordPlaceholder')}
                autoComplete="current-password"
              />
              <p className="text-xs text-muted-foreground">
                {t('closeCashDrawer.managerPasswordHint', {
                  threshold: VARIANCE_PIN_THRESHOLD,
                })}
              </p>
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {noDrawerOpen ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                onClick={handleSignOutAnyway}
                className="h-11 flex-1 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {t('closeCashDrawer.signOut')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(PATHS.openCashDrawer)}
                className="h-11 flex-1 cursor-pointer border-border text-primary hover:bg-[var(--brand-soft)]"
              >
                {t('closeCashDrawer.openCashDrawer')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={busy || isClosing || isExpectedLoading}
                className="h-11 flex-1 cursor-pointer bg-gradient-to-r from-primary to-[var(--brand-deep)] text-primary-foreground hover:opacity-95"
              >
                {busy || isClosing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t('closeCashDrawer.closing')}
                  </>
                ) : (
                  t('closeCashDrawer.confirmClose')
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={busy || isClosing}
                className="h-11 flex-1 cursor-pointer border-border text-primary hover:bg-[var(--brand-soft)]"
              >
                {cashDrawerOpen
                  ? t('closeCashDrawer.backToPos')
                  : t('closeCashDrawer.openCashDrawer')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function BreakdownRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="font-medium text-foreground">
        {formatMoney(Number(value) || 0)}
      </span>
    </div>
  )
}
