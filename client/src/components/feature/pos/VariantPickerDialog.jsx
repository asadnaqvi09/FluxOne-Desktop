import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ENDPOINTS } from '@/api/endpoints'
import { apiRequest } from '@/api/apiHelper'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatMoney } from '@/lib/formatCurrency'
import { mapApiProduct, mapApiProducts } from '@/lib/mapProduct'
import {
  childDisplayName,
  collectOptionAxes,
  resolveChildBySelection,
} from '@/lib/variantResolve'
import { stockTone } from '@/lib/cartMath'
import { cn } from '@/lib/utils'

/**
 * Prefer reusable VariantPickerDialog — do not inline option UI in ProductGrid.
 * Use shadcn Dialog + Button + Badge for picker states.
 */
export default function VariantPickerDialog({
  open,
  onOpenChange,
  parent,
  variantChildren,
  onConfirm,
}) {
  const { t } = useTranslation()
  const [children, setChildren] = useState(() => variantChildren || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selection, setSelection] = useState({})

  useEffect(() => {
    if (!open || !parent?.id) return
    let cancelled = false
    setSelection({})
    setError('')

    if (Array.isArray(variantChildren) && variantChildren.length) {
      setChildren(variantChildren)
      return undefined
    }

    ;(async () => {
      setLoading(true)
      try {
        const data = await apiRequest(ENDPOINTS.productChildren(parent.id), {
          method: 'GET',
        })
        if (cancelled) return
        setChildren(mapApiProducts(data?.children || []))
      } catch (err) {
        if (cancelled) return
        setError(err?.error || err?.message || t('pos.failedLoadVariants'))
        setChildren([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, parent?.id, variantChildren, t])

  const axes = useMemo(() => collectOptionAxes(children), [children])
  const resolved = useMemo(
    () => resolveChildBySelection(children, selection, axes),
    [children, selection, axes],
  )

  const canAdd = Boolean(resolved) && Number(resolved.stock) > 0
  const tone = resolved ? stockTone(resolved.stock) : 'out'

  const handleConfirm = () => {
    if (!canAdd || !resolved) return
    onConfirm?.(resolved)
    onOpenChange?.(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>{parent?.name || t('pos.chooseVariant')}</DialogTitle>
          <DialogDescription>{t('pos.chooseVariantHint')}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('pos.loadingVariants')}
          </p>
        ) : error ? (
          <p className="py-4 text-sm text-destructive">{error}</p>
        ) : children.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">{t('pos.noVariants')}</p>
        ) : (
          <div className="flex max-h-[50vh] flex-col gap-4 overflow-y-auto">
            {axes.map((axis) => (
              <div key={axis.typeName} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {axis.typeName}
                </p>
                <div className="flex flex-wrap gap-2">
                  {axis.values.map((val) => {
                    const active = selection[axis.typeName] === val.valueName
                    return (
                      <Button
                        key={val.valueName}
                        type="button"
                        size="sm"
                        variant={active ? 'default' : 'outline'}
                        onClick={() =>
                          setSelection((prev) => ({
                            ...prev,
                            [axis.typeName]: val.valueName,
                          }))
                        }
                      >
                        {val.valueName}
                      </Button>
                    )
                  })}
                </div>
              </div>
            ))}

            {resolved ? (
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-sm font-medium">{childDisplayName(resolved)}</p>
                <p className="mt-1 text-sm font-bold text-orange-500">
                  {formatMoney(resolved.price)}
                </p>
                <Badge
                  className={cn(
                    'mt-2',
                    tone === 'in' && 'bg-emerald-50 text-emerald-700',
                    tone === 'low' && 'bg-amber-50 text-amber-800',
                    tone === 'out' && 'bg-red-50 text-red-700',
                  )}
                  variant="secondary"
                >
                  {tone === 'out'
                    ? t('pos.noStock')
                    : t('pos.availableStock', { stock: resolved.stock })}
                </Badge>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t('pos.selectAllOptions')}</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
            {t('shared.cancel')}
          </Button>
          <Button type="button" disabled={!canAdd} onClick={handleConfirm}>
            {t('pos.addToCart')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Map raw API parent for picker open helpers */
export function toPickerParent(product) {
  return mapApiProduct(product)
}
