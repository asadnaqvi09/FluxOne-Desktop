import { useTranslation } from 'react-i18next'
import { formatMoney } from '@/lib/formatCurrency'
import StatsCards from '@/components/shared/StatsCards'

/** KPI row — Total Revenue / Invoices / Avg / Today Sales */
export default function InvoiceStats({ stats }) {
  const { t } = useTranslation()
  const cards = [
    { label: t('invoices.statsTotalRevenue'), value: formatMoney(stats.totalRevenue) },
    { label: t('invoices.statsInvoices'), value: String(stats.count) },
    { label: t('invoices.statsAvgInvoice'), value: formatMoney(stats.avgInvoice) },
    { label: t('invoices.statsTodaySales'), value: formatMoney(stats.todaySales) },
  ]

  return <StatsCards cards={cards} interactive />
}
