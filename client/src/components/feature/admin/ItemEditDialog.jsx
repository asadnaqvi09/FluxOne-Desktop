import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useAdminProducts } from '@/hooks/useAdminProducts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAppDispatch, useAppSelector } from '@/rtk/hooks'
import { selectAuthToken } from '@/rtk/features/auth/authSlice'
import {
  fetchAdminProduct,
  selectAdminProductById,
} from '@/rtk/features/admin/adminSlice'

/** Product tax rate as percentage (17 = 17%). */
function taxPctFromProduct(source, slot) {
  const taxes = source?.taxes
  if (Array.isArray(taxes) && taxes[slot]) {
    return Number(taxes[slot].rate) || 0
  }
  const frac = slot === 0 ? source?.tax1Rate : source?.tax2Rate
  if (!frac) return 0
  return Math.round(Number(frac) * 10000) / 100
}

/** Keep tax % between 0 and 100 while typing. */
function clampTaxPctInput(value) {
  if (value === '' || value === null || value === undefined) return ''
  const n = Number(value)
  if (Number.isNaN(n)) return ''
  if (n < 0) return '0'
  if (n > 100) return '100'
  return value
}

export default function ItemEditDialog({ product, open, onClose }) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const token = useAppSelector(selectAuthToken)
  const detail = useAppSelector(selectAdminProductById(product?.id))
  const { updateProductRates, isUpdating } = useAdminProducts({ skip: true })
  const source = detail?.product || product

  useEffect(() => {
    if (!open || !product?.id || !token) return
    dispatch(fetchAdminProduct(product.id))
  }, [open, product?.id, token, dispatch])

  const [form, setForm] = useState({
    price: 0,
    discountPct: 0,
    tax1Pct: '',
    tax2Pct: '',
  })

  useEffect(() => {
    if (!source) return
    setForm({
      price: source.price,
      discountPct: source.discountPct || 0,
      tax1Pct: taxPctFromProduct(source, 0),
      tax2Pct: taxPctFromProduct(source, 1),
    })
  }, [source])

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const setTax = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: clampTaxPctInput(value) }))
  }

  const handleSave = async () => {
    if (!product) return
    const tax1 = Number(form.tax1Pct) || 0
    const tax2 = Number(form.tax2Pct) || 0
    if (tax1 > 100 || tax2 > 100) {
      toast.error(t('itemsRate.taxRangeError'))
      return
    }
    const result = await updateProductRates(product.id, {
      price: form.price,
      discountPct: form.discountPct,
      taxRates: [tax1, tax2],
    })
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success(t('itemsRate.ratesUpdated', { name: product.name }))
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('itemsRate.dialogTitle', {
              sku: source?.sku || product?.sku || '',
            })}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-[9px] leading-tight text-muted-foreground">
              {(source?.imageUrl || product?.imageUrl) ? (
                <img
                  src={source?.imageUrl || product?.imageUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                t('itemsRate.productImgPlaceholder')
              )}
            </span>
            <span>
              {source?.name || product?.name} ·{' '}
              {source?.category || product?.category}
              {(source?.subCategory || product?.subCategory)
                ? ` / ${source?.subCategory || product?.subCategory}`
                : ''}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="price" className="font-semibold">
              {t('itemsRate.sellingPriceLabel')}
            </Label>
            <Input
              id="price"
              type="number"
              min={0}
              step={1}
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="discountPct" className="font-semibold">
              {t('itemsRate.discountPctLabel')}
            </Label>
            <Input
              id="discountPct"
              type="number"
              min={0}
              max={100}
              step={1}
              value={form.discountPct}
              onChange={(e) => set('discountPct', e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tax1Pct" className="font-semibold">
              {t('itemsRate.tax1PctLabel')}
            </Label>
            <Input
              id="tax1Pct"
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={form.tax1Pct}
              onChange={(e) => setTax('tax1Pct', e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tax2Pct" className="font-semibold">
              {t('itemsRate.tax2PctLabel')}
            </Label>
            <Input
              id="tax2Pct"
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={form.tax2Pct}
              onChange={(e) => setTax('tax2Pct', e.target.value)}
              className="h-11"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t('itemsRate.taxHint')}
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('itemsRate.cancel')}
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            disabled={isUpdating}
            onClick={handleSave}
          >
            {t('itemsRate.saveRates')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
