import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { FILTER_SELECT_CLASS } from '@/components/shared/DateInput'
import ClearFiltersButton from '@/components/shared/ClearFiltersButton'

const EMPTY_FILTERS = {
  query: '',
  categoryId: '',
  sub: '',
}

function subValue(s) {
  return typeof s === 'string' ? s : s.id
}

function subLabel(s) {
  return typeof s === 'string' ? s : s.name
}

export default function ItemFilters({ filters, categories, onChange }) {
  const { t } = useTranslation()
  const set = (key, value) => {
    const next = { ...filters, [key]: value }
    if (key === 'categoryId') next.sub = ''
    onChange(next)
  }

  const cat = categories.find((c) => c.id === filters.categoryId)
  const subs = cat?.subs || []
  const hasSubs = subs.length > 0
  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={filters.query}
        onChange={(e) => set('query', e.target.value)}
        placeholder={t('itemsRate.searchPlaceholder')}
        className="h-10 min-w-[200px] flex-1"
      />
      <select
        aria-label={t('itemsRate.categoryAria')}
        value={filters.categoryId}
        onChange={(e) => set('categoryId', e.target.value)}
        className={FILTER_SELECT_CLASS}
      >
        <option value="">{t('itemsRate.allCategories')}</option>
        {categories
          .filter((c) => c.id !== 'popular' && c.id !== 'all')
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </select>
      <select
        aria-label={t('itemsRate.subCategoryAria')}
        value={filters.sub}
        onChange={(e) => set('sub', e.target.value)}
        disabled={!hasSubs}
        className={FILTER_SELECT_CLASS}
      >
        <option value="">
          {hasSubs ? t('itemsRate.allSubCategories') : t('itemsRate.noSubCategory')}
        </option>
        {subs.map((s) => (
          <option key={subValue(s)} value={subValue(s)}>
            {subLabel(s)}
          </option>
        ))}
      </select>
      <ClearFiltersButton
        disabled={!hasFilters}
        onClick={() => onChange({ ...EMPTY_FILTERS })}
      />
    </div>
  )
}
