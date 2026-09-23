import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCheckout } from '@/hooks/useCheckout'
import { useCart } from '@/hooks/useCart'
import { useSaleTabs } from '@/hooks/useSaleTabs'
import { useMinPending } from '@/hooks/useMinPending'
import { formatMoney, parseMoneyInput, roundMoney } from '@/lib/formatCurrency'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

/**
 * .pos-right — Pay with cash (flex: 0 0 auto under totals).
 */
export default function CashPay() {
  const { t } = useTranslation()
  const { activeTab, activeTabId } = useSaleTabs()
  const { cart } = useCart()
  const { totals, payTotal, isExchange, checkout, isCheckingOut } = useCheckout()
  const { pending: minBusy, run } = useMinPending(500)
  const [tendered, setTendered] = useState('')
  const [tenderedTabId, setTenderedTabId] = useState(activeTabId)

  // Reset tender only when switching to a different sale tab (not on refetch flicker).
  useEffect(() => {
    if (!activeTabId || activeTabId === tenderedTabId) return
    setTenderedTabId(activeTabId)
    setTendered('')
  }, [activeTabId, tenderedTabId])

  const exchange = Boolean(isExchange || activeTab?.exchangeMode)
  const netDue = roundMoney(exchange ? payTotal : totals.total)
  const customerPays = netDue > 0
  const storeRefunds = exchange && netDue < 0
  const dueCollect = customerPays ? netDue : 0
  const refundAmount = storeRefunds ? Math.abs(netDue) : 0

  const tenderedNum = parseMoneyInput(tendered)
  const tenderedRounded = Number.isNaN(tenderedNum) ? NaN : roundMoney(tenderedNum)
  const change = customerPays
    ? Math.max(0, (Number.isNaN(tenderedRounded) ? 0 : tenderedRounded) - dueCollect)
    : refundAmount
  const lineCount = cart.filter((l) => !l.returned && l.qty > 0).length
  const busy = isCheckingOut || minBusy
  const tenderOk =
    !customerPays ||
    (!Number.isNaN(tenderedRounded) && tenderedRounded >= dueCollect)
  const canComplete = lineCount > 0 && tenderOk && !busy

  const fillExact = () => {
    setTendered(dueCollect > 0 ? String(dueCollect) : '')
  }

  const handleComplete = async () => {
    if (!lineCount) {
      toast.error(t('cashPay.cartEmpty'))
      return
    }
    if (!tenderOk) {
      toast.error(t('cashPay.enterAtLeast', { amount: formatMoney(dueCollect) }))
      return
    }

    const wasExchange = exchange
    await run(async () => {
      const result = await checkout({
        tendered: customerPays
          ? Number.isNaN(tenderedRounded)
            ? 0
            : tenderedRounded
          : 0,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setTendered('')
      toast.success(
        wasExchange
          ? t('cashPay.exchangeCompleted', { id: result.data.id })
          : t('cashPay.paymentCompleted', { id: result.data.id }),
      )
    })
  }

  return (
    <div className="space-y-3">
      <h3 className="m-0 text-sm font-bold text-foreground">{t('cashPay.title')}</h3>

      <div className="flex items-center justify-between border-b border-border pb-2 text-sm font-bold">
        <span>
          {exchange
            ? storeRefunds
              ? t('cashPay.refundDue')
              : netDue === 0
                ? t('cashPay.evenExchange')
                : t('cashPay.netToCollect')
            : t('cashPay.totalPrice')}
        </span>
        <strong>
          {formatMoney(storeRefunds ? refundAmount : exchange ? dueCollect : netDue)}
        </strong>
      </div>

      {customerPays || !exchange ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="tendered" className="font-semibold">
              {t('cashPay.paymentGiven')}
            </Label>
            {dueCollect > 0 ? (
              <button
                type="button"
                onClick={fillExact}
                className="cursor-pointer text-xs font-semibold text-primary hover:underline"
              >
                {t('cashPay.exactAmount')}
              </button>
            ) : null}
          </div>
          <Input
            id="tendered"
            type="text"
            inputMode="decimal"
            value={tendered}
            onChange={(e) => setTendered(e.target.value)}
            className="h-11"
            placeholder={
              dueCollect > 0
                ? String(dueCollect)
                : t('cashPay.tenderPlaceholderExample')
            }
          />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t('cashPay.noPaymentNeeded')}
        </p>
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {storeRefunds
            ? t('cashPay.refundToCustomer')
            : t('cashPay.paymentToReturn')}
        </span>
        <strong>{formatMoney(change)}</strong>
      </div>

      <Button
        type="button"
        disabled={!canComplete}
        onClick={handleComplete}
        className="h-11 w-full cursor-pointer bg-primary text-base text-primary-foreground hover:bg-primary/90"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Check className="size-4" />
        )}
        {busy
          ? t('cashPay.processing')
          : exchange
            ? t('cashPay.completeExchange')
            : t('cashPay.completeSale')}
      </Button>
    </div>
  )
}
