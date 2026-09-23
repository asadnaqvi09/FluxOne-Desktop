import { useTranslation } from 'react-i18next'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

function empKey(emp) {
  return emp.id || emp.userId
}

export default function EmployeePicker({
  cashiers,
  selectedId,
  assignedId,
  onSelect,
  onConfirm,
  onEdit,
  confirming = false,
}) {
  const { t } = useTranslation()
  const dirty = selectedId && selectedId !== assignedId

  return (
    <Card className="border-border shadow-sm">
      <CardContent className="space-y-3 p-5">
        <div>
          <h3 className="text-base font-bold">{t('cashiers.existingEmployees')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('cashiers.employeesHint')}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {cashiers.map((emp) => {
            const key = empKey(emp)
            const selected = key === selectedId
            return (
              <div
                key={key}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3 py-3 transition-colors',
                  selected
                    ? 'border-primary bg-[var(--brand-soft)]'
                    : 'border-border bg-card hover:bg-muted/40',
                )}
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    name="assign-cashier"
                    className="size-4 accent-[var(--brand)] cursor-pointer"
                    checked={selected}
                    onChange={() => onSelect(key)}
                  />
                  <Avatar className="size-9 bg-primary text-primary-foreground">
                    <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                      {emp.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0">
                    <strong className="block text-sm text-foreground">
                      {emp.name}
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      {emp.userId}
                      {emp.isActive === false
                        ? ` · ${t('cashiers.inactive')}`
                        : ''}
                    </span>
                  </span>
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 cursor-pointer text-muted-foreground hover:text-primary"
                  title={t('cashiers.editCashierTitle')}
                  aria-label={t('cashiers.editCashierAria', { name: emp.name })}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onSelect(key)
                    onEdit?.(emp)
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
              </div>
            )
          })}
        </div>

        {/* <Button
          type="button"
          disabled={!dirty || confirming}
          onClick={onConfirm}
          className="h-10 cursor-pointer bg-gradient-to-r from-primary to-[var(--brand-deep)] text-primary-foreground hover:opacity-95"
        >
          {confirming ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t('cashiers.updating')}
            </>
          ) : (
            t('cashiers.confirmUpdate')
          )}
        </Button> */}
      </CardContent>
    </Card>
  )
}
