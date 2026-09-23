import { useTranslation } from 'react-i18next'
import { useCheckout } from '@/hooks/useCheckout'
import { useSaleTabs } from '@/hooks/useSaleTabs'
import { formatMoney } from '@/lib/formatCurrency'

/** .totals-grid — shrink-0 under cart list (never overlaps) */
export default function BillTotals() {
  const { t } = useTranslation()
  const { activeTab } = useSaleTabs()
  const { totals, exchangeCredit, payTotal, isExchange } = useCheckout()
  const exchange = isExchange || Boolean(activeTab?.exchangeMode)
  const netDue = roundNet(payTotal)
  const refundDue = exchange && netDue < 0

  const taxRows =
    Array.isArray(totals.taxes) && totals.taxes.length > 0
      ? totals.taxes.map((tax, i) => ({
          label: t('bill.taxN', { n: i + 1 }),
          value: Number(tax.amount) || 0,
        }))
      : [
          { label: t('bill.tax1'), value: totals.tax1 },
          { label: t('bill.tax2'), value: totals.tax2 },
        ]

  const rows = [
    { label: t('bill.actualPrice'), value: totals.actual },
    { label: t('bill.afterDiscount'), value: totals.after },
    ...taxRows,
  ]

  return (
    <div className="totals-grid space-y-2.5 text-sm">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">{r.label}</span>
          <strong className="font-semibold text-foreground">{formatMoney(r.value)}</strong>
        </div>
      ))}
      {exchange ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{t('bill.replacementTotal')}</span>
            <strong className="font-semibold text-foreground">
              {formatMoney(totals.total)}
            </strong>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{t('bill.exchangeCredit')}</span>
            <strong className="font-semibold text-foreground">
              {formatMoney(exchangeCredit)}
            </strong>
          </div>
        </>
      ) : null}
      <div className="flex items-center justify-between gap-3 border-t border-border pt-2.5">
        <span className="font-semibold text-foreground">
          {exchange
            ? refundDue
              ? t('bill.refundDue')
              : t('bill.netToCollect')
            : t('bill.total')}
        </span>
        <strong className="text-lg font-bold text-primary">
          {formatMoney(exchange ? Math.abs(netDue) : totals.total)}
        </strong>
      </div>
    </div>
  )
}

function roundNet(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}
