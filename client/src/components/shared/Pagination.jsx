import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Prev → current, next, … last → Next (invoices + activity logs + items). */
export default function PaginationBar({
  page,
  pageCount,
  totalLabel,
  onPageChange,
  className,
  disabled = false,
}) {
  const { t } = useTranslation()
  const pages = Math.max(1, pageCount)
  const current = Math.min(Math.max(1, page), pages)
  const nextPage = current + 1
  const showNextNum = nextPage <= pages
  const showLast = pages > nextPage

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm text-muted-foreground',
        className,
      )}
    >
      <span>{totalLabel}</span>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || current <= 1}
          onClick={() => onPageChange(current - 1)}
        >
          {t('shared.paginationPrev')}
        </Button>

        <PageNum
          n={current}
          active
          disabled={disabled}
          onClick={() => onPageChange(current)}
        />

        {showNextNum ? (
          <PageNum
            n={nextPage}
            disabled={disabled}
            onClick={() => onPageChange(nextPage)}
          />
        ) : null}

        {showLast ? (
          <>
            <span className="px-1 text-muted-foreground" aria-hidden>
              …
            </span>
            <PageNum
              n={pages}
              disabled={disabled}
              onClick={() => onPageChange(pages)}
            />
          </>
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || current >= pages}
          onClick={() => onPageChange(current + 1)}
        >
          {t('shared.paginationNext')}
        </Button>
      </div>
    </div>
  )
}

function PageNum({ n, active = false, disabled, onClick }) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'default' : 'outline'}
      disabled={disabled}
      aria-current={active ? 'page' : undefined}
      className="min-w-8"
      onClick={onClick}
    >
      {n}
    </Button>
  )
}
