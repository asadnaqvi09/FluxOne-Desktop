import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { useInvoice, useInvoiceActions } from '@/hooks/useInvoiceActions'
import { PATHS } from '@/router/paths'
import { formatMoney } from '@/lib/formatCurrency'
import { STORE_PROFILE } from '@/data/products'
import { normalizeStoreForSlip } from '@/lib/mapInvoice'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  TypePill,
  PaymentStatusPill,
} from '@/components/feature/invoices/InvoiceStatusPills'
import InvoiceActionDialogs, {
  ReturnSlipDialog,
} from '@/components/feature/invoices/InvoiceActionDialogs'
import ReceiptDialog from '@/components/feature/print/ReceiptDialog'

export default function InvoiceDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { invoice: inv, isLoading, isError, error, refetch } = useInvoice(id)
  const { reprint, loadExchanges } = useInvoiceActions()

  const [returnTarget, setReturnTarget] = useState(null)
  const [exchangeTarget, setExchangeTarget] = useState(null)
  const [historyTarget, setHistoryTarget] = useState(null)
  const [historyEvents, setHistoryEvents] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const store = normalizeStoreForSlip(inv?.store) || STORE_PROFILE
  const storeName = store.name || STORE_PROFILE.name
  const storeBranch = store.branch || store.address || STORE_PROFILE.branch

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8">
        <p className="text-muted-foreground">{t('invoices.detailLoading')}</p>
      </div>
    )
  }

  if (isError || !inv) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8">
        <p className="text-muted-foreground">
          {error?.error || t('invoices.detailNotFound')}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(PATHS.invoices)}
        >
          {t('invoices.backToInvoices')}
        </Button>
      </div>
    )
  }

  const handleReturn = () => {
    const returnable = (inv.items || []).some((i) => !i.returned && i.qty > 0)
    if (!returnable) {
      toast.warning(t('invoices.noItemsLeftToReturn'))
      return
    }
    setReturnTarget(inv)
  }

  const handleExchange = () => {
    const available = (inv.items || []).some((i) => !i.returned && i.qty > 0)
    if (!available) {
      toast.error(
        inv.type === 'Return'
          ? t('invoices.cannotExchangeReturned')
          : t('invoices.noItemsToExchange'),
      )
      return
    }
    setExchangeTarget(inv)
  }

  const handlePrevExchange = async () => {
    setHistoryLoading(true)
    setHistoryTarget(inv)
    setHistoryEvents([])
    try {
      const result = await loadExchanges(inv.id)
      if (!result.success) {
        toast.error(result.error)
        setHistoryTarget(null)
        return
      }
      if (!(result.data.events || []).length) {
        toast.warning(t('invoices.noPreviousExchange'))
        setHistoryTarget(null)
        return
      }
      setHistoryEvents(result.data.events)
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleReprint = async () => {
    const result = await reprint(inv.id)
    if (!result.success) toast.error(result.error)
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 lg:px-8">
      <button
        type="button"
        onClick={() => navigate(PATHS.invoices)}
        className="inline-flex w-fit cursor-pointer items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="size-4" />
        {t('invoices.backToInvoices')}
      </button>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.7fr)]">
        <Card className="overflow-visible border-border shadow-sm">
          <CardContent className="space-y-5 overflow-visible p-6">
            <div>
              <h2 className="text-2xl font-bold">{inv.id}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {storeName} · {storeBranch}
                <br />
                {format(inv.createdAt, 'd MMM yyyy, h:mm a')}
                {inv.cashierId ? ` · ${inv.cashierId}` : ''}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="text-sm text-muted-foreground">
                  {t('invoices.labelType')}
                </span>
                <TypePill type={inv.type || 'Sale'} />
                <span className="text-sm text-muted-foreground">
                  {t('invoices.labelPayment')}
                </span>
                <PaymentStatusPill status={inv.paymentStatus || 'Paid'} />
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-start text-muted-foreground">
                  <th className="py-2 font-medium">{t('invoices.colItem')}</th>
                  <th className="py-2 font-medium">{t('invoices.colId')}</th>
                  <th className="py-2 font-medium">{t('invoices.colQty')}</th>
                  <th className="py-2 text-end font-medium">{t('invoices.colPrice')}</th>
                </tr>
              </thead>
              <tbody>
                {(inv.items || []).map((i, idx) => (
                  <tr key={i.lineId || i.id || idx} className="border-b border-border/70">
                    <td className="py-2">
                      {i.name}
                      {i.returned ? (
                        <span className="text-muted-foreground">
                          {t('invoices.returnedSuffix')}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2">{i.sku}</td>
                    <td className="py-2">{i.qty}</td>
                    <td className="py-2 text-end">
                      {formatMoney(i.unitPrice * i.qty)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="text-sm">
              {t('invoices.subTotalDiscountTax', {
                subtotal: formatMoney(inv.subtotal || 0),
                discount: formatMoney(inv.discount || 0),
                tax: formatMoney(inv.tax || 0),
              })}
              <br />
              <strong className="text-base">
                {t('invoices.totalLine', { total: formatMoney(inv.total) })}
              </strong>
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-visible border-border shadow-sm">
          <CardContent className="space-y-3.5 overflow-visible p-6">
            <p className="rounded-lg border border-primary/20 bg-[var(--brand-soft)]/60 px-3 py-2.5 text-sm text-foreground">
              {t('invoices.returnExchangeNote')}
            </p>
            <Button
              type="button"
              variant="secondary"
              className="h-10 w-full"
              onClick={handleReturn}
            >
              {t('invoices.return')}
            </Button>
            <Button
              type="button"
              className="h-10 w-full"
              onClick={handleExchange}
            >
              {t('invoices.exchange')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-10 w-full"
              onClick={handlePrevExchange}
            >
              {t('invoices.previousExchangeItems')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full"
              onClick={handleReprint}
            >
              {t('invoices.printDownload')}
            </Button>

            <h3 className="pt-2 text-sm font-bold">{t('invoices.editHistory')}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {(inv.history || []).length ? (
                (inv.history || []).map((h, i) => (
                  <li key={h.id || i} className="border-b border-border/50 pb-2">
                    {format(h.at, 'd MMM yyyy, h:mm a')} — {h.text}
                  </li>
                ))
              ) : (
                <li>{t('invoices.noHistory')}</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <InvoiceActionDialogs
        returnTarget={returnTarget}
        exchangeTarget={exchangeTarget}
        historyTarget={historyTarget}
        historyEvents={historyEvents}
        historyLoading={historyLoading}
        onCloseReturn={() => {
          setReturnTarget(null)
          refetch()
        }}
        onCloseExchange={() => setExchangeTarget(null)}
        onCloseHistory={() => {
          setHistoryTarget(null)
          setHistoryEvents([])
        }}
      />
      <ReturnSlipDialog />
      <ReceiptDialog />
    </div>
  )
}
