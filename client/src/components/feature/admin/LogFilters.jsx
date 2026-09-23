import { useTranslation } from 'react-i18next'
import DateInput, { FILTER_SELECT_CLASS } from '@/components/shared/DateInput'
import ClearFiltersButton from '@/components/shared/ClearFiltersButton'
import { LOG_ACTIONS } from '@/data/adminLogs'

const EMPTY_FILTERS = {
  date: '',
  action: '',
  cashierId: '',
}

function cashierOptionValue(c) {
  return c.id || c.userId
}

function cashierOptionLabel(c) {
  const login = c.userId || c.id
  return `${c.name} (${login})`
}

function actionLabelKey(value) {
  if (!value) return 'activityLogs.actions.all'
  return `activityLogs.actions.${value}`
}

export default function LogFilters({ filters, cashiers, onChange }) {
  const { t } = useTranslation()
  const set = (key, value) => onChange({ ...filters, [key]: value })
  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <DateInput
          value={filters.date || ''}
          onChange={(e) => set('date', e.target.value)}
          title={t('activityLogs.dateTitle')}
          className="h-10 w-auto cursor-pointer"
        />
        <select
          aria-label={t('activityLogs.actionFilterAria')}
          value={filters.action}
          onChange={(e) => set('action', e.target.value)}
          className={FILTER_SELECT_CLASS}
        >
          {LOG_ACTIONS.map((o) => (
            <option key={o.value || 'all-actions'} value={o.value}>
              {t(actionLabelKey(o.value))}
            </option>
          ))}
        </select>
        <select
          aria-label={t('activityLogs.cashierFilterAria')}
          value={filters.cashierId}
          onChange={(e) => set('cashierId', e.target.value)}
          className={FILTER_SELECT_CLASS}
        >
          <option value="">{t('activityLogs.allCashiers')}</option>
          {cashiers.map((c) => (
            <option key={cashierOptionValue(c)} value={cashierOptionValue(c)}>
              {cashierOptionLabel(c)}
            </option>
          ))}
        </select>
        <ClearFiltersButton
          disabled={!hasFilters}
          onClick={() => onChange({ ...EMPTY_FILTERS })}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {t('activityLogs.filtersHint')}
      </p>
    </div>
  )
}
