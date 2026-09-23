import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSaleTabs } from '@/hooks/useSaleTabs'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

/**
 * Sale tabs row + solid purple add button (figma/Cashier POS1).
 */
export default function SaleTabs() {
  const { t } = useTranslation()
  const {
    tabs,
    activeTabId,
    addSaleTab,
    selectSaleTab,
    closeSaleTab,
    isCreating,
  } = useSaleTabs()

  const handleAdd = async () => {
    const result = await addSaleTab()
    if (!result.success) toast.error(result.error)
  }

  const handleClose = async (id) => {
    const result = await closeSaleTab(id)
    if (!result.success) toast.error(result.error)
  }

  return (
    <div className="sale-tabs-bar flex shrink-0 items-center gap-2.5 border-b border-border bg-card px-4 py-2.5">
      <div className="sale-tabs flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
        {tabs.map((tab, index) => {
          const active = tab.id === activeTabId
          const n = tab.seq || index + 1
          return (
            <div
              key={tab.id}
              className={cn(
                'inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1 py-0.5',
                active
                  ? 'border-transparent bg-gradient-to-r from-primary to-[var(--brand-deep)] text-primary-foreground shadow-sm'
                  : 'border-border bg-background text-foreground',
              )}
            >
              <button
                type="button"
                onClick={() => selectSaleTab(tab.id)}
                className="cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-semibold"
              >
                {t('pos.saleTabLabel', { n })}
              </button>
              {tabs.length > 1 ? (
                <button
                  type="button"
                  title={t('pos.closeTab')}
                  onClick={() => handleClose(tab.id)}
                  className={cn(
                    'me-1 cursor-pointer rounded-full p-0.5',
                    active ? 'hover:bg-white/20' : 'hover:bg-muted',
                  )}
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          )
        })}

        <button
          type="button"
          id="btn-new-sale-tab"
          onClick={handleAdd}
          disabled={isCreating}
          title={t('pos.openAnotherSale')}
          aria-label={t('pos.openAnotherSale')}
          className={cn(
            'sale-tab-add inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full',
            'bg-primary text-primary-foreground shadow-sm',
            'transition-opacity hover:opacity-90 disabled:opacity-50',
          )}
        >
          <Plus className="size-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
