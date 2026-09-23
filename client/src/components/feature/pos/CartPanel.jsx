import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCart } from '@/hooks/useCart'
import { formatMoney } from '@/lib/formatCurrency'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export default function CartPanel({ listHeightPx = 260 }) {
  const { t } = useTranslation()
  const { activeTab, cart, setLineQty, removeLine } = useCart()
  const exchange = Boolean(activeTab?.exchangeMode)
  const saleLabel = t('pos.saleTabLabel', {
    n: activeTab?.seq || 1,
  })
  const cancelledMsg = t('cart.qtyChangeCancelled')

  const handleQty = async (lineId, qty) => {
    const result = await setLineQty(lineId, qty)
    if (result && !result.success && result.error !== cancelledMsg) {
      toast.error(result.error)
    }
  }

  const handleRemove = async (lineId) => {
    const result = await removeLine(lineId)
    if (!result.success) toast.error(result.error)
  }

  return (
    <div className="flex flex-col">
      <div className="mb-3">
        <h2 className="m-0 text-lg font-bold text-foreground">
          {exchange
            ? t('cart.exchangeCartTitle')
            : t('cart.saleCartTitle', {
                label: activeTab?.seq
                  ? saleLabel
                  : activeTab?.label || t('cart.fallbackSaleLabel'),
              })}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t('cart.subtitle')}
        </p>
      </div>

      {/* Fixed height — extra products scroll here, totals do not move. */}
      <div
        className="overflow-y-auto rounded-xl border border-dashed border-border bg-[#fafafa] p-2.5"
        style={{ height: listHeightPx }}
      >
        {cart.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-3 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ShoppingCart className="size-6" />
            </div>
            <p className="max-w-[240px] text-sm text-muted-foreground">
              {exchange ? t('cart.emptyExchange') : t('cart.emptySale')}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {cart.map((line) => (
              <li
                key={line.lineId}
                className="flex items-start gap-2 rounded-xl border border-border bg-card p-2.5"
              >
                <span className="text-xl">{line.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{line.name}</p>
                  <p className="text-xs text-primary">{line.sku}</p>
                  {line.kept ? (
                    <Badge variant="secondary" className="mt-1 text-[10px]">
                      {t('cart.kept')}
                    </Badge>
                  ) : null}
                  <p className="mt-0.5 text-sm font-medium">
                    {formatMoney(line.unitPrice * line.qty)}
                    <span className="ms-1 text-xs font-normal text-muted-foreground">
                      {t('cart.exTax')}
                    </span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {!line.kept ? (
                    <div className="flex items-center gap-1 rounded-lg border border-border bg-card">
                      <button
                        type="button"
                        className="cursor-pointer p-1.5 hover:bg-muted"
                        onClick={() => handleQty(line.lineId, line.qty - 1)}
                        aria-label={t('cart.decreaseQty')}
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="min-w-6 text-center text-sm font-semibold">
                        {line.qty}
                      </span>
                      <button
                        type="button"
                        className="cursor-pointer p-1.5 hover:bg-muted"
                        onClick={() => handleQty(line.lineId, line.qty + 1)}
                        aria-label={t('cart.increaseQty')}
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="min-w-6 text-center text-sm font-semibold">
                      ×{line.qty}
                    </span>
                  )}
                  {!line.kept ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="text-destructive"
                      onClick={() => handleRemove(line.lineId)}
                      title={t('cart.removeLine')}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
