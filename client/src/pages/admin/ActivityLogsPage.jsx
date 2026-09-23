import { useMemo, useState, useDeferredValue } from 'react'
import { useTranslation } from 'react-i18next'
import PageHeader from '@/components/shared/PageHeader'
import PaginationBar from '@/components/shared/Pagination'
import { Card, CardContent } from '@/components/ui/card'
import LogStats from '@/components/feature/admin/LogStats'
import LogFilters from '@/components/feature/admin/LogFilters'
import LogTable from '@/components/feature/admin/LogTable'
import { useAdminLogs } from '@/hooks/useAdminLogs'
import { cn } from '@/lib/utils'

const LOGS_PAGE_SIZE = 10
const EMPTY_FILTERS = {
  date: '',
  action: '',
  cashierId: '',
}

export default function ActivityLogsPage() {
  const { t } = useTranslation()
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
  const [page, setPage] = useState(1)
  const deferredFilters = useDeferredValue(filters)
  const filtersPending =
    deferredFilters !== filters &&
    JSON.stringify(deferredFilters) !== JSON.stringify(filters)

  const { logs, stats, cashiers, isLoading } = useAdminLogs(deferredFilters)

  const pageCount = Math.max(1, Math.ceil(logs.length / LOGS_PAGE_SIZE) || 1)
  const safePage = Math.min(page, pageCount)
  const pageLogs = useMemo(() => {
    const start = (safePage - 1) * LOGS_PAGE_SIZE
    return logs.slice(start, start + LOGS_PAGE_SIZE)
  }, [logs, safePage])

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
        title={t('activityLogs.title')}
        subtitle={t('activityLogs.subtitle')}
      />

      {/* Log stats */}
      <LogStats stats={stats} />

      {/* Log table */}
      <Card className="overflow-visible border-border shadow-sm">
        <CardContent className="space-y-4 overflow-visible p-4">
          {/* Log filters */}
          <LogFilters
            filters={filters}
            cashiers={cashiers}
            onChange={handleFilterChange}
          />
          {isLoading ? (
            <div className="space-y-2 py-2">
              {[0, 1, 2].map((i) => (
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
              <LogTable
                logs={pageLogs}
                emptyMessage={
                  filters.date
                    ? t('activityLogs.emptyFiltered')
                    : t('activityLogs.emptyDefault')
                }
              />
            </div>
          )}
          {/* Pagination */}
          <PaginationBar
            page={safePage}
            pageCount={pageCount}
            totalLabel={t('activityLogs.totalLabel', { count: logs.length })}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
    </div>
  )
}
