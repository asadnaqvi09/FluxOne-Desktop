import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import DateInput, { FILTER_SELECT_CLASS } from '@/components/shared/DateInput'
import ClearFiltersButton from '@/components/shared/ClearFiltersButton'

const EMPTY_FILTERS = {
  q: '',
  day: '',
  hourFrom: '',
  hourTo: '',
  type: '',
}

const FROM_HOURS = ['9', '10', '11', '12', '13', '14', '15', '16', '17']
const TO_HOURS = ['10', '11', '12', '13', '14', '15', '16', '17', '18']

const HOUR_KEY = {
  '9': 'h09',
  '10': 'h10',
  '11': 'h11',
  '12': 'h12',
  '13': 'h13',
  '14': 'h14',
  '15': 'h15',
  '16': 'h16',
  '17': 'h17',
  '18': 'h18',
}

/**
 * Filter invoices — search ID, date, time from/to, type.
 * Empty date (dd/mm/yyyy) means all invoices.
 */
export default function InvoiceFilters({ filters, onChange }) {
  const { t } = useTranslation()
  const set = (key, value) => onChange({ ...filters, [key]: value })
  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-muted/30 p-3">
        <Input
          value={filters.q}
          onChange={(e) => set('q', e.target.value)}
          placeholder={t('invoices.searchPlaceholder')}
          className="h-10 min-w-[200px] flex-1 bg-background"
        />
        <DateInput
          value={filters.day}
          onChange={(e) => set('day', e.target.value)}
          title={t('invoices.dateTitle')}
          className="h-10 w-auto cursor-pointer bg-background"
        />
        <select
          aria-label={t('invoices.fromTimeAria')}
          title={t('invoices.timeFromPlaceholder')}
          value={filters.hourFrom}
          onChange={(e) => set('hourFrom', e.target.value)}
          className={FILTER_SELECT_CLASS}
        >
          <option value="">{t('timeOptions.fromTime')}</option>
          {FROM_HOURS.map((h) => (
            <option key={h} value={h}>
              {t(`timeOptions.${HOUR_KEY[h]}`)}
            </option>
          ))}
        </select>
        <select
          aria-label={t('invoices.toTimeAria')}
          title={t('invoices.timeToPlaceholder')}
          value={filters.hourTo}
          onChange={(e) => set('hourTo', e.target.value)}
          className={FILTER_SELECT_CLASS}
        >
          <option value="">{t('timeOptions.toTime')}</option>
          {TO_HOURS.map((h) => (
            <option key={h} value={h}>
              {t(`timeOptions.${HOUR_KEY[h]}`)}
            </option>
          ))}
        </select>
        <select
          aria-label={t('invoices.typeFilterAria')}
          value={filters.type}
          onChange={(e) => set('type', e.target.value)}
          className={FILTER_SELECT_CLASS}
        >
          <option value="">{t('invoices.allTypes')}</option>
          <option value="Sale">{t('invoices.typeSale')}</option>
          <option value="Return">{t('invoices.typeReturn')}</option>
          <option value="Exchange">{t('invoices.typeExchange')}</option>
        </select>
        <ClearFiltersButton
          disabled={!hasFilters}
          onClick={() => onChange({ ...EMPTY_FILTERS })}
        />
      </div>
      <p className="text-xs text-muted-foreground">{t('invoices.filtersHint')}</p>
    </div>
  )
}
