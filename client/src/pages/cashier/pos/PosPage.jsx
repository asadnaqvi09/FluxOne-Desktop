import { useDeferredValue } from 'react'
import { useTranslation } from 'react-i18next'
import SaleTabs from '@/components/feature/pos/SaleTabs'
import CatalogSearch from '@/components/feature/pos/CatalogSearch'
import CategoryBar from '@/components/feature/pos/CategoryBar'
import ProductGrid from '@/components/feature/pos/ProductGrid'
import CartPanel from '@/components/feature/pos/CartPanel'
import BillTotals from '@/components/feature/pos/BillTotals'
import CashPay from '@/components/feature/pos/CashPay'
import ExchangeBanner from '@/components/feature/pos/ExchangeBanner'
import ReceiptDialog from '@/components/feature/print/ReceiptDialog'
import InvoiceActionDialogs from '@/components/feature/invoices/InvoiceActionDialogs'
import { usePos } from '@/context/PosContext'
import { useProducts } from '@/hooks/useProducts'
import PaginationBar from '@/components/shared/Pagination'

// Change these two numbers until the POS looks right on the cashier screen.
const CATALOG_HEIGHT_PX = 660
const CART_LIST_HEIGHT_PX = 260

export default function PosPage() {
  const { t } = useTranslation()
  const { exchangePicker, closeExchangePicker, categoryId, subCategory, searchQuery, page, pageSize, setPage } = usePos()

  const deferredQuery = useDeferredValue(searchQuery)
  const deferredCategory = useDeferredValue(categoryId)
  const deferredSub = useDeferredValue(subCategory)

  const { total, pageCount, needsSubcategory, isLoading } = useProducts({
    categoryId: deferredCategory,
    subCategory: deferredSub,
    query: deferredQuery,
    page,
    pageSize,
  })

  const searching = Boolean(deferredQuery.trim())
  const needsSub = !searching && needsSubcategory && !deferredSub
  const safePage = Math.min(page, pageCount)
  const from = total ? (safePage - 1) * pageSize + 1 : 0
  const to = Math.min(safePage * pageSize, total)

  return (
    <div className="flex flex-1 flex-col">
      <div>
        <SaleTabs />
      </div>
      <div>
        <ExchangeBanner />
      </div>

      <div
        className={[
          'grid items-start gap-5 p-4 md:p-5',
          'grid-cols-1',
          'lg:grid-cols-[minmax(0,1.55fr)_minmax(400px,0.85fr)]',
          'xl:grid-cols-[minmax(0,1.65fr)_minmax(420px,0.8fr)]',
        ].join(' ')}
      >
        {/* LEFT: Catalog */}
        <section
          className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[var(--app-shadow)]"
          style={{ height: CATALOG_HEIGHT_PX }}
        >
          <div className="shrink-0 space-y-3.5 pb-4">
            <CatalogSearch />
            <CategoryBar />
          </div>
          <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">
            <ProductGrid />
          </div>
          <PaginationBar
            page={safePage}
            pageCount={needsSub ? 1 : pageCount}
            totalLabel={
              total
                ? t('pos.showingRange', { from, to, total, pageSize })
                : t('pos.zeroItems', { pageSize })
            }
            onPageChange={setPage}
            disabled={needsSub || isLoading}
            className="mt-3 shrink-0"
          />
        </section>

        {/* RIGHT: Ticket — cart list is a fixed box; totals + pay stay below it */}
        <section className="flex flex-col rounded-2xl border border-border bg-card shadow-[var(--app-shadow)]">
          <div className="flex flex-col gap-4 p-5 pb-0">
            <CartPanel listHeightPx={CART_LIST_HEIGHT_PX} />
            <div className="border-t border-border py-4">
              <BillTotals />
            </div>
          </div>
          <aside className="border-t border-border p-5">
            <CashPay />
          </aside>
        </section>
      </div>

      <ReceiptDialog />
      <InvoiceActionDialogs
        exchangeTarget={exchangePicker}
        onCloseExchange={closeExchangePicker}
        onCloseReturn={() => { }}
        onCloseHistory={() => { }}
      />
    </div>
  )
}
