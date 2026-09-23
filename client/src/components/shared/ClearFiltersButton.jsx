import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Shared reset for invoice, activity-log, and items-rate filter bars. */
export default function ClearFiltersButton({ onClick, disabled = false }) {
  const { t } = useTranslation()
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      className="h-10 cursor-pointer gap-1.5 px-3"
      title={t('shared.clearFiltersTitle')}
    >
      <X className="size-4" />
      {t('shared.clearFilters')}
    </Button>
  )
}
