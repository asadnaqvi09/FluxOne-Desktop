import { useTranslation } from 'react-i18next'
import StatsCards from '@/components/shared/StatsCards'

/** Same KPI cards as invoices — hover scale + purple background. */
export default function LogStats({ stats }) {
  const { t } = useTranslation()
  const cards = [
    { key: 'logins', label: t('activityLogs.statsLogins'), value: stats.logins },
    { key: 'sales', label: t('activityLogs.statsSales'), value: stats.sales },
    { key: 'returns', label: t('activityLogs.statsReturns'), value: stats.returns },
    { key: 'exchanges', label: t('activityLogs.statsExchanges'), value: stats.exchanges },
  ]

  return <StatsCards cards={cards} interactive />
}
