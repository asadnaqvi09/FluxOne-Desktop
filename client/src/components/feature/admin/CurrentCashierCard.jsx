import { useTranslation } from 'react-i18next'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'

export default function CurrentCashierCard({ cashier }) {
  const { t } = useTranslation()

  if (!cashier) {
    return (
      <Card className="border-border shadow-sm">
        <CardContent className="p-5">
          <h3 className="text-base font-bold">{t('cashiers.currentCashier')}</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            {t('cashiers.noCashierAssigned')}
          </p>
        </CardContent>
      </Card>
    )
  }

  const rows = [
    { label: t('cashiers.labelId'), value: cashier.userId },
    { label: t('cashiers.labelName'), value: cashier.name },
    {
      label: t('cashiers.labelPicture'),
      value: t('cashiers.pictureAvatar', { initials: cashier.initials }),
    },
    { label: t('cashiers.labelEmail'), value: cashier.email },
  ]

  return (
    <Card className="border-border shadow-sm">
      <CardContent className="space-y-4 p-5">
        <h3 className="text-base font-bold">{t('cashiers.currentCashier')}</h3>
        <div className="flex items-center gap-3">
          <Avatar className="size-12 bg-primary text-primary-foreground">
            <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
              {cashier.initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-bold text-foreground">{cashier.name}</p>
            <p className="text-xs text-muted-foreground">
              {t('cashiers.assignedToDrawer')}
            </p>
          </div>
        </div>
        <dl className="space-y-0">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between gap-3 border-b border-border/70 py-2.5 text-sm last:border-b-0"
            >
              <dt className="text-muted-foreground">{r.label}</dt>
              <dd className="font-semibold text-foreground">{r.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
