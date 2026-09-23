import { useState, useDeferredValue } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useInvoices } from '@/hooks/useInvoices'
import { useInvoiceActions } from '@/hooks/useInvoiceActions'
import { INVOICE_PAGE_SIZE } from '@/data/invoices'
import PageHeader from '@/components/shared/PageHeader'
import PaginationBar from '@/components/shared/Pagination'
import InvoiceStats from '@/components/feature/invoices/InvoiceStats'
import InvoiceFilters from '@/components/feature/invoices/InvoiceFilters'
import InvoiceTable from '@/components/feature/invoices/InvoiceTable'
import InvoiceActionDialogs, {
  ReturnSlipDialog,
} from '@/components/feature/invoices/InvoiceActionDialogs'
import ReceiptDialog from '@/components/feature/print/ReceiptDialog'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export default function InvoicesPage() {
  const { t } = useTranslation()
  const { loadInvoice, reprint, loadExchanges } = useInvoiceActions()
  const [filters, setFilters] = useState({
    q: '',
    day: '',
    hourFrom: '',
    hourTo: '',
    type: '',
  })
  const deferredFilters = useDeferredValue(filters)
  const filtersPending =
    JSON.stringify(deferredFilters) !== JSON.stringify(filters)
  const [page, setPage] = useState(1)
  const [returnTarget, setReturnTarget] = useState(null)
  const [exchangeTarget, setExchangeTarget] = useState(null)
  const [historyTarget, setHistoryTarget] = useState(null)
  const [historyEvents, setHistoryEvents] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)

  const {
    invoices,
    total,
    pageCount,
    page: safePage,
    stats,
    isLoading,
    isError,
    error,
  } = useInvoices({
    ...deferredFilters,
    page,
    pageSize: INVOICE_PAGE_SIZE,
  })

  const handleFilterChange = (next) => {
    setFilters(next)
    setPage(1)
  }

  const handleReprint = async (inv) => {
    setActionBusy(true)
    try {
      const result = await reprint(inv.id)
      if (!result.success) toast.error(result.error)
    } finally {
      setActionBusy(false)
    }
  }

  const handleReturn = async (inv) => {
    setActionBusy(true)
    try {
      const result = await loadInvoice(inv.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      const detail = result.data
      const returnable = (detail.items || []).some(
        (i) => !i.returned && i.qty > 0,
      )
      if (!returnable) {
        toast.warning(t('invoices.noItemsLeftToReturn'))
        return
      }
      setReturnTarget(detail)
    } finally {
      setActionBusy(false)
    }
  }

  const handleExchange = async (inv) => {
    setActionBusy(true)
    try {
      const result = await loadInvoice(inv.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      const detail = result.data
      const available = (detail.items || []).some(
        (i) => !i.returned && i.qty > 0,
      )
      if (!available) {
        toast.error(
          detail.type === 'Return'
            ? t('invoices.cannotExchangeReturned')
            : t('invoices.noItemsToExchange'),
        )
        return
      }
      setExchangeTarget(detail)
    } finally {
      setActionBusy(false)
    }
  }

  const handlePrevExchange = async (inv) => {
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

  const hasActiveFilters = Boolean(
    filters.day ||
      filters.q ||
      filters.hourFrom ||
      filters.hourTo ||
      filters.type,
  )

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 lg:px-8">
      <PageHeader
        title={t('invoices.pageTitle')}
        subtitle={t('invoices.pageSubtitle')}
      />
      <InvoiceStats stats={stats} />

      <Card className="overflow-visible border-border shadow-sm">
        <CardContent className="space-y-5 overflow-visible p-5">
          <InvoiceFilters filters={filters} onChange={handleFilterChange} />

          {isLoading ? (
            <div className="space-y-2 py-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded-lg bg-muted/70"
                />
              ))}
            </div>
          ) : isError ? (
            <p className="py-8 text-center text-sm text-destructive">
              {error?.error || t('invoices.failedLoad')}
            </p>
          ) : (
            <div
              className={cn(
                'transition-opacity duration-200',
                filtersPending && 'opacity-60',
              )}
            >
              <InvoiceTable
                invoices={invoices}
                emptyMessage={
                  hasActiveFilters
                    ? t('invoices.emptyFiltered')
                    : t('invoices.emptyDefault')
                }
                onReprint={handleReprint}
                onReturn={handleReturn}
                onExchange={handleExchange}
                onPrevExchange={handlePrevExchange}
              />
            </div>
          )}

          <PaginationBar
            page={safePage}
            pageCount={pageCount}
            totalLabel={
              actionBusy
                ? t('invoices.totalLabelBusy', { total })
                : t('invoices.totalLabel', { total })
            }
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <InvoiceActionDialogs
        returnTarget={returnTarget}
        exchangeTarget={exchangeTarget}
        historyTarget={historyTarget}
        historyEvents={historyEvents}
        historyLoading={historyLoading}
        onCloseReturn={() => setReturnTarget(null)}
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
