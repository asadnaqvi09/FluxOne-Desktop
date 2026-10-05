import { useState } from 'react'
import { Camera, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import VariantPickerDialog from '@/components/feature/pos/VariantPickerDialog'
import { usePos } from '@/context/PosContext'
import { useCart } from '@/hooks/useCart'
import { useProductSkuLookup, useProducts } from '@/hooks/useProducts'
import { childDisplayName } from '@/lib/variantResolve'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/formatCurrency'

/**
 * Search name / SKU / barcode — suggestions from API; Enter = exact SKU lookup.
 * Prefer reusable VariantPickerDialog when barcode hits a variant parent.
 */
export default function CatalogSearch() {
  const { t } = useTranslation()
  const { searchQuery, setSearch } = usePos()
  const { addItem } = useCart()
  const { lookup, isLoading: lookupBusy } = useProductSkuLookup()
  const [open, setOpen] = useState(false)
  const [picker, setPicker] = useState(null)

  const { products: suggestions } = useProducts({
    query: searchQuery,
    page: 1,
    pageSize: 8,
    skip: searchQuery.trim().length < 1,
  })

  const addSellable = async (product, { scanned = false } = {}) => {
    const result = await addItem({
      productId: product.id,
      product,
    })
    if (!result.success) {
      toast.error(result.error)
      return false
    }
    setSearch('')
    setOpen(false)
    if (result.warning) toast.warning(result.warning)
    else {
      toast.success(
        scanned
          ? t('pos.scannedItemAdded')
          : t('pos.addedToast', { name: childDisplayName(product) || product.name }),
      )
    }
    return true
  }

  const handleLookupResult = async (found, { scanned = false } = {}) => {
    if (!found.success) {
      toast.error(found.error || (scanned ? t('pos.scanFailed') : undefined))
      return
    }
    if (found.data?.needsVariantPick) {
      setPicker({
        parent: found.data.product,
        children: found.data.children || [],
      })
      setOpen(false)
      return
    }
    await addSellable(found.data.product, { scanned })
  }

  const handleKeyDown = async (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const code = searchQuery.trim()
    if (!code) return
    const found = await lookup(code)
    await handleLookupResult(found)
  }

  /** Demo scan: uses current search as barcode, or looks up a popular SKU */
  const handleScan = async () => {
    const code = searchQuery.trim() || 'DRK-001'
    const found = await lookup(code)
    await handleLookupResult(found, { scanned: true })
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          autoFocus
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder={t('pos.searchPlaceholder')}
          className="h-11 pe-11 ps-9"
          autoComplete="off"
          disabled={lookupBusy}
        />
        <button
          type="button"
          title={t('pos.scanBarcodeTitle')}
          aria-label={t('pos.scanBarcodeAria')}
          onClick={handleScan}
          className="absolute top-1/2 end-2 inline-flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Camera className="size-5" />
        </button>
      </div>

      {open && suggestions.length > 0 ? (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-card shadow-lg">
          {suggestions.map((p) => {
            const isParent = p.isVariantParent || p.productType === 'variant'
            const disabled = !isParent && p.stock <= 0
            return (
              <button
                key={p.id}
                type="button"
                disabled={disabled}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-start text-sm hover:bg-muted',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={async () => {
                  if (isParent) {
                    setPicker({ parent: p, children: [] })
                    setOpen(false)
                    return
                  }
                  if (p.stock <= 0) return
                  await addSellable(p)
                }}
              >
                <span className="text-xl">{p.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {childDisplayName(p) || p.name}
                  </span>
                  <span className="text-xs text-primary">{p.sku}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {isParent ? t('pos.variantsBadge') : formatMoney(p.price)}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}

      <VariantPickerDialog
        open={Boolean(picker)}
        onOpenChange={(next) => {
          if (!next) setPicker(null)
        }}
        parent={picker?.parent}
        variantChildren={picker?.children}
        onConfirm={async (child) => {
          await addSellable(child)
          setPicker(null)
        }}
      />
    </div>
  )
}
