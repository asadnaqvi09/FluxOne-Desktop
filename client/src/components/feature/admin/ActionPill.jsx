import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const TONE = {
  login: 'bg-sky-50 text-sky-700',
  logout: 'bg-red-50 text-red-700',
  change_cashier: 'bg-amber-50 text-amber-800',
  sale: 'bg-emerald-50 text-emerald-700',
  return: 'bg-red-50 text-red-700',
  exchange: 'bg-violet-50 text-violet-800',
  price_change: 'bg-amber-50 text-amber-800',
}

export default function ActionPill({ action }) {
  const { t } = useTranslation()
  const label = t(`activityLogs.actions.${action}`, { defaultValue: action })

  return (
    <Badge
      variant="secondary"
      className={cn('border-0 font-semibold', TONE[action] || 'bg-muted text-foreground')}
    >
      {label}
    </Badge>
  )
}
