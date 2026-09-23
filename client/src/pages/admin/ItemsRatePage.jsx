import { useState, useDeferredValue } from 'react'
import { useTranslation } from 'react-i18next'
import PageHeader from '@/components/shared/PageHeader'
import PaginationBar from '@/components/shared/Pagination'
import { Card, CardContent } from '@/components/ui/card'
import ItemFilters from '@/components/feature/admin/ItemFilters'
import ItemTable from '@/components/feature/admin/ItemTable'
import ItemEditDialog from '@/components/feature/admin/ItemEditDialog'
import { useAdminProducts } from '@/hooks/useAdminProducts'
import { ADMIN_ITEM_PAGE_SIZE } from '@/data/products'
import { cn } from '@/lib/utils'

export default function ItemsRatePage() {
  const { t } = useTranslation()
  const [filters, setFilters] = useState({
    query: '',
    categoryId: '',
    sub: '',
  })
  const deferredFilters = useDeferredValue(filters)
  const filtersPending =
    JSON.stringify(deferredFilters) !== JSON.stringify(filters)
  const [page, setPage] = useState(1)
  const [editTarget, setEditTarget] = useState(null)

  const {
    products,
    total,
    pageCount,
    categories,
    isLoading,
  } = useAdminProducts({
    ...deferredFilters,
    page,
    pageSize: ADMIN_ITEM_PAGE_SIZE,
  })

  const safePage = Math.min(page, pageCount)

  // Handle filter change
  const handleFilterChange = (next) => {
    setFilters(next)
    setPage(1)
  }

  // Render
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* Page header */}
      <PageHeader
        title={t('itemsRate.title')}
        subtitle={t('itemsRate.subtitle')}
      />

      {/* Item filters */}
      <Card className="overflow-visible border-border shadow-sm">
        <CardContent className="space-y-4 overflow-visible p-4">
          <ItemFilters
            filters={filters}
            categories={categories}
            onChange={handleFilterChange}
          />
          {/* Item table */}
          {isLoading ? (
            <div className="space-y-2 py-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded-lg bg-muted/70"
                />
              ))}
            </div>
          ) : (
            <div
              className={cn(
                'transition-opacity duration-200',
                filtersPending && 'opacity-60',
              )}
            >
              <ItemTable products={products} onOpen={setEditTarget} />
            </div>
          )}
          {/* Pagination */}
          <PaginationBar
            page={safePage}
            pageCount={pageCount}
            totalLabel={t('itemsRate.totalLabel', { count: total })}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      {/* Item edit dialog */}
      <ItemEditDialog
        product={editTarget}
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
      />
    </div>
  )
}
