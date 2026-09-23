import { useDeferredValue } from 'react'
import { useTranslation } from 'react-i18next'
import { usePos } from '@/context/PosContext'
import { useCart } from '@/hooks/useCart'
import { useProducts } from '@/hooks/useProducts'
import { stockTone } from '@/lib/cartMath'
import { formatMoney } from '@/lib/formatCurrency'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export default function ProductGrid() {
  const { t } = useTranslation()
  const {
    categoryId,
    subCategory,
    searchQuery,
    page,
    pageSize,
  } = usePos()
  const deferredQuery = useDeferredValue(searchQuery)
  const deferredCategory = useDeferredValue(categoryId)
  const deferredSub = useDeferredValue(subCategory)
  const filtersPending =
    deferredQuery !== searchQuery ||
    deferredCategory !== categoryId ||
    deferredSub !== subCategory
  const { addItem } = useCart()

  const {
    products,
    needsSubcategory,
    isLoading,
    isError,
    error,
  } = useProducts({
    categoryId: deferredCategory,
    subCategory: deferredSub,
    query: deferredQuery,
    page,
    pageSize,
  })

  const searching = Boolean(deferredQuery.trim())
  const needsSub = !searching && needsSubcategory && !deferredSub

  const stockText = (stock) => {
    const tone = stockTone(stock)
    if (tone === 'out') return t('pos.noStock')
    if (tone === 'low') return t('pos.lowStock', { stock })
    return t('pos.inStock')
  }

  const handleAdd = async (p) => {
    const r = await addItem({ productId: p.id, product: p })
    if (!r.success) {
      toast.error(r.error)
      return
    }
    if (r.warning) toast.warning(r.warning)
    else toast.success(t('pos.addedToast', { name: p.name }))
  }

  return (
    <div>
      <div
        className={cn(
          'grid content-start gap-3 pt-1 transition-opacity duration-200',
          'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
          filtersPending && 'opacity-60',
        )}
      >
        {needsSub ? (
          <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
            {t('pos.chooseSubcategory')}
            <br />
            <span className="text-muted-foreground/80">
              {t('pos.chooseSubcategoryExample')}
            </span>
          </p>
        ) : isLoading ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="min-h-[148px] animate-pulse rounded-xl bg-muted/70"
              />
            ))}
          </>
        ) : isError ? (
          <p className="col-span-full py-10 text-center text-sm text-destructive">
            {error?.error || t('pos.failedLoadProducts')}
          </p>
        ) : products.length === 0 ? (
          <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
            {t('pos.noItemsMatch')}
          </p>
        ) : (
          products.map((p) => {
            const tone = stockTone(p.stock)
            const outOfStock = p.stock <= 0
            const label = stockText(p.stock)
            return (
              <button
                key={p.id}
                type="button"
                disabled={outOfStock}
                onClick={() => handleAdd(p)}
                className={cn(
                  'flex cursor-pointer flex-col items-start rounded-xl border border-border bg-card p-3 text-start transition-colors',
                  'hover:border-primary/60 hover:bg-[var(--brand-soft)]/60',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg bg-muted">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <img
                      src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Zm9vZHxlbnwwfHwwfHx8MA%3D%3D"
                      alt={t('pos.productImageAlt')}
                    />
                  )}
                </div>

                <strong className="mt-2 line-clamp-2 text-[0.88rem] leading-snug text-foreground">
                  {p.name}
                </strong>

                <span className="mt-1 text-xs text-muted-foreground">
                  {tone === 'out'
                    ? label
                    : t('pos.availableStock', { stock: p.stock })}
                </span>

                <span className="mt-1 text-sm font-bold text-orange-500">
                  {formatMoney(p.price)}
                </span>

                <span
                  className={cn(
                    'mt-2 rounded-full px-2.5 py-0.5 text-[10px] font-semibold',
                    tone === 'in' && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
                    tone === 'low' && 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400',
                    tone === 'out' && 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
                  )}
                >
                  {label}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
