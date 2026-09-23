import { useTranslation } from 'react-i18next'
import { usePos } from '@/context/PosContext'
import { useCategories } from '@/hooks/useCategories'
import { useProducts } from '@/hooks/useProducts'
import { cn } from '@/lib/utils'

/**
 * Main category chips + subcategory chips + breadcrumb.
 * Categories from GET /categories; subs from listProducts needsSubcategory payload.
 */
export default function CategoryBar() {
  const { t } = useTranslation()
  const {
    categoryId,
    subCategory,
    searchQuery,
    selectCategory,
    selectSubCategory,
    clearSubCategory,
  } = usePos()

  const { categories, isLoading: catsLoading } = useCategories()
  const searching = Boolean(searchQuery.trim())

  const { needsSubcategory, subcategories, category } = useProducts({
    categoryId,
    subCategory: '', // always ask without sub so server returns subcategory list when needed
    query: '',
    page: 1,
    skip: searching || !categoryId || categoryId === 'all' || categoryId === 'popular',
  })

  const cat =
    categories.find((c) => c.id === categoryId) ||
    (category ? { id: category.id, name: category.name, hasSubcategories: true } : null)

  const showSubs =
    !searching &&
    categoryId !== 'all' &&
    categoryId !== 'popular' &&
    (Boolean(cat?.hasSubcategories) || needsSubcategory)

  const subs = subcategories

  return (
    <div className="space-y-3">
      <div className="text-sm">
        {searching ? (
          <span className="font-semibold text-primary">{t('pos.searchResults')}</span>
        ) : cat ? (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className="cursor-pointer font-bold text-primary hover:underline"
              onClick={clearSubCategory}
            >
              {cat.name}
            </button>
            {subCategory ? (
              <>
                <span className="text-muted-foreground">›</span>
                <span className="font-medium text-foreground">
                  {subs.find((s) => s.id === subCategory)?.name || subCategory}
                </span>
              </>
            ) : null}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {catsLoading && categories.length <= 1 ? (
          <span className="text-sm text-muted-foreground">
            {t('pos.loadingCategories')}
          </span>
        ) : (
          categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => selectCategory(c.id)}
              className={cn(
                'cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                categoryId === c.id && !searching
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:border-primary/40',
              )}
            >
              {c.name}
            </button>
          ))
        )}
      </div>

      {showSubs ? (
        <div className="flex flex-wrap gap-2">
          {subs.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              {t('pos.loadingSubcategories')}
            </span>
          ) : (
            subs.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => selectSubCategory(s.id)}
                className={cn(
                  'cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors',
                  subCategory === s.id
                    ? 'border-primary bg-[var(--brand-soft)] text-primary'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground',
                )}
              >
                {s.name}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
