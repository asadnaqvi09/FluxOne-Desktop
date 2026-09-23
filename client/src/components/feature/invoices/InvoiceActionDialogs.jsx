import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { formatMoney } from '@/lib/formatCurrency'
import { usePos } from '@/context/PosContext'
import { useInvoiceActions } from '@/hooks/useInvoiceActions'
import { PATHS } from '@/router/paths'
import { STORE_PROFILE } from '@/data/products'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { usePrintSlip } from '@/components/feature/print/usePrintSlip'

function ItemChecklist({ items, selected, onToggle, t }) {
  return (
    <div className="max-h-64 space-y-2 overflow-y-auto py-2">
      {items.map(({ it }) => {
        const id = it.id || it.lineId
        return (
          <label
            key={id}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-2.5 hover:bg-muted/40"
          >
            <Checkbox
              checked={selected.has(id)}
              onCheckedChange={() => onToggle(id)}
              className="mt-0.5 cursor-pointer"
            />
            <span className="min-w-0 text-sm">
              <strong className="block">{it.name}</strong>
              <span className="text-muted-foreground">
                {t('invoiceDialogs.itemMeta', {
                  sku: it.sku,
                  qty: it.qty,
                  amount: formatMoney(it.unitPrice * it.qty),
                })}
              </span>
            </span>
          </label>
        )
      })}
    </div>
  )
}

/**
 * Return / Exchange / Prev-exchange dialogs — server APIs.
 */
export default function InvoiceActionDialogs({
  returnTarget,
  exchangeTarget,
  historyTarget,
  historyEvents,
  historyLoading,
  onCloseReturn,
  onCloseExchange,
  onCloseHistory,
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const {
    processReturn,
    startExchange,
    isReturning,
    isStartingExchange,
  } = useInvoiceActions()
  const [selected, setSelected] = useState(() => new Set())
  const [selectionFor, setSelectionFor] = useState(null)

  const returnable = useMemo(() => {
    if (!returnTarget) return []
    return (returnTarget.items || [])
      .filter((it) => !it.returned && it.qty > 0 && (it.id || it.lineId))
      .map((it) => ({ it }))
  }, [returnTarget])

  const exchangeable = useMemo(() => {
    if (!exchangeTarget) return []
    return (exchangeTarget.items || [])
      .filter((it) => !it.returned && it.qty > 0 && (it.id || it.lineId))
      .map((it) => ({ it }))
  }, [exchangeTarget])

  const selectionKey = returnTarget
    ? `return:${returnTarget.id}`
    : exchangeTarget
      ? `exchange:${exchangeTarget.id}`
      : null

  if (selectionFor !== selectionKey) {
    setSelectionFor(selectionKey)
    if (returnTarget) {
      setSelected(
        new Set(returnable.map(({ it }) => it.id || it.lineId).filter(Boolean)),
      )
    } else if (exchangeTarget?.preselectedIds?.length) {
      setSelected(new Set(exchangeTarget.preselectedIds))
    } else {
      setSelected(new Set())
    }
  }

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleConfirmReturn = async () => {
    const result = await processReturn(returnTarget.id, [...selected])
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success(t('invoiceDialogs.returnConfirmed'))
    onCloseReturn()
  }

  const handleContinueExchange = async () => {
    const result = await startExchange(exchangeTarget.id, [...selected])
    if (!result.success) {
      toast.error(result.error)
      return
    }
    const editingOnPos = Boolean(exchangeTarget?.preselectedIds)
    toast.success(
      editingOnPos
        ? t('invoiceDialogs.exchangeUpdated')
        : t('invoiceDialogs.addReplacements'),
    )
    onCloseExchange()
    if (!editingOnPos) navigate(PATHS.pos)
  }

  const events =
    historyEvents ||
    historyTarget?.exchangeHistory ||
    []

  return (
    <>
      <ConfirmDialog
        open={Boolean(returnTarget)}
        onOpenChange={(open) => {
          if (!open) onCloseReturn()
        }}
        title={
          returnTarget
            ? t('invoiceDialogs.confirmReturnTitle', { id: returnTarget.id })
            : t('invoiceDialogs.confirmReturnTitleFallback')
        }
        description={t('invoiceDialogs.confirmReturnDescription')}
        confirmLabel={t('invoiceDialogs.confirmReturnSlip')}
        cancelLabel={t('invoiceDialogs.cancel')}
        onConfirm={handleConfirmReturn}
        confirmDisabled={selected.size === 0 || returnable.length === 0}
        busy={isReturning}
      >
        {returnable.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('invoiceDialogs.noItemsLeftToReturn')}
          </p>
        ) : (
          <ItemChecklist
            items={returnable}
            selected={selected}
            onToggle={toggle}
            t={t}
          />
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(exchangeTarget)}
        onOpenChange={(open) => {
          if (!open) onCloseExchange()
        }}
        title={
          exchangeTarget
            ? t('invoiceDialogs.exchangeSelectTitle', { id: exchangeTarget.id })
            : t('invoiceDialogs.exchangeSelectTitleFallback')
        }
        description={t('invoiceDialogs.exchangeSelectDescription')}
        confirmLabel={
          exchangeTarget?.preselectedIds
            ? t('invoiceDialogs.updateGivenItems')
            : t('invoiceDialogs.continueToPos')
        }
        cancelLabel={t('invoiceDialogs.cancel')}
        onConfirm={handleContinueExchange}
        confirmDisabled={selected.size === 0 || exchangeable.length === 0}
        busy={isStartingExchange}
      >
        {exchangeable.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('invoiceDialogs.noItemsAvailable')}
          </p>
        ) : (
          <ItemChecklist
            items={exchangeable}
            selected={selected}
            onToggle={toggle}
            t={t}
          />
        )}
      </ConfirmDialog>

      <Dialog
        open={Boolean(historyTarget)}
        onOpenChange={(open) => {
          if (!open) onCloseHistory()
        }}
      >
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>
              {t('invoiceDialogs.prevExchangeTitle', {
                id: historyTarget?.id || '',
              })}
            </DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <p className="text-sm text-muted-foreground">
              {t('invoiceDialogs.loadingExchanges')}
            </p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('invoiceDialogs.noPreviousExchange')}
            </p>
          ) : (
            <div className="max-h-[60vh] space-y-4 overflow-y-auto">
              {events.map((h, i) => (
                <div
                  key={h.id || i}
                  className="space-y-2 rounded-xl border border-border p-3"
                >
                  <p className="text-xs text-muted-foreground">
                    {format(h.at, 'd MMM yyyy, h:mm a')} ·{' '}
                    {t('invoiceDialogs.netLabel', {
                      amount: formatMoney(h.net || 0),
                    })}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <strong className="text-sm">
                        {t('invoiceDialogs.givenByClient')}
                      </strong>
                      {(h.given || []).map((line, j) => (
                        <div
                          key={j}
                          className="mt-1 flex justify-between text-sm text-muted-foreground"
                        >
                          <span>
                            {line.name} ({line.sku})
                          </span>
                          <strong>×{line.qty}</strong>
                        </div>
                      ))}
                    </div>
                    <div>
                      <strong className="text-sm">
                        {t('invoiceDialogs.received')}
                      </strong>
                      {(h.received || []).map((line, j) => (
                        <div
                          key={j}
                          className="mt-1 flex justify-between text-sm text-muted-foreground"
                        >
                          <span>
                            {line.name} ({line.sku})
                          </span>
                          <strong>×{line.qty}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button type="button" onClick={onCloseHistory}>
              {t('invoiceDialogs.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Return slip modal after confirm */
export function ReturnSlipDialog() {
  const { t } = useTranslation()
  const { returnSlip, closeReturnSlip } = usePos()
  const { printSlip } = usePrintSlip()
  const open = Boolean(returnSlip)
  const storeName = returnSlip?.invoice?.store?.name || STORE_PROFILE.name
  const slipAt = useMemo(() => {
    if (!returnSlip) return null
    return returnSlip.invoice?.createdAt || new Date()
  }, [returnSlip])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeReturnSlip()
      }}
    >
      <DialogContent
        className="flex max-h-[min(90dvh,720px)] flex-col gap-3 overflow-hidden sm:max-w-md"
        showCloseButton
      >
        <DialogHeader className="shrink-0 pe-8">
          <DialogTitle>{t('returnSlip.title')}</DialogTitle>
        </DialogHeader>
        {returnSlip ? (
          <div
            id="print-area"
            className="receipt-scroll min-h-0 flex-1 space-y-3 overscroll-contain bg-white text-sm"
          >
            <div>
              <h2 className="text-lg font-bold">{t('returnSlip.title')}</h2>
              <p>
                <strong>{returnSlip.invoice.id}</strong>
                <br />
                {slipAt ? format(slipAt, 'd MMM yyyy, h:mm a') : ''}
                <br />
                {storeName}
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-start">
                  <th className="py-1">{t('returnSlip.colReturnedItem')}</th>
                  <th className="py-1">{t('returnSlip.colId')}</th>
                  <th className="py-1 text-end">{t('returnSlip.colQty')}</th>
                </tr>
              </thead>
              <tbody>
                {returnSlip.lines.map((i, idx) => (
                  <tr key={i.id || idx} className="border-b border-border/60">
                    <td className="py-1">{i.name}</td>
                    <td className="py-1">{i.sku}</td>
                    <td className="py-1 text-end">{i.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              {t('returnSlip.refund')}{' '}
              {formatMoney(
                returnSlip.refundAmount ?? returnSlip.invoice.cashRefunded ?? 0,
              )}
            </p>
            <p className="text-muted-foreground">{t('returnSlip.restoredNote')}</p>
          </div>
        ) : null}
        <DialogFooter className="shrink-0 gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => printSlip(returnSlip?.invoice?.id)}
          >
            {t('returnSlip.printSlip')}
          </Button>
          <Button type="button" onClick={closeReturnSlip}>
            {t('returnSlip.done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
