import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * Edit cashier modal — pencil opens; X / Cancel discard; Save persists.
 */
export default function EditCashierDialog({
  open,
  cashier,
  saving = false,
  onClose,
  onSave,
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    name: '',
    userId: '',
    isActive: true,
  })
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !cashier) return
    setForm({
      name: cashier.name || '',
      userId: cashier.userId || '',
      isActive: cashier.isActive !== false,
    })
    setError('')
  }, [open, cashier])

  const handleSave = async () => {
    setError('')
    const name = String(form.name || '').trim()
    const userId = String(form.userId || '').trim()
    if (!name) {
      setError(t('cashiers.nameRequired'))
      return
    }
    if (!userId) {
      setError(t('cashiers.userIdRequired'))
      return
    }
    const result = await onSave?.({
      name,
      userId,
      isActive: form.isActive,
    })
    if (result && !result.success) {
      setError(result.error || t('cashiers.failedUpdate'))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose?.()
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>{t('cashiers.editDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('cashiers.editDialogDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="edit-cashier-name">{t('cashiers.nameLabel')}</Label>
            <Input
              id="edit-cashier-name"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              className="h-10"
              disabled={!cashier || saving}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-cashier-userid">{t('cashiers.userIdLabel')}</Label>
            <Input
              id="edit-cashier-userid"
              value={form.userId}
              onChange={(e) =>
                setForm((f) => ({ ...f, userId: e.target.value }))
              }
              className="h-10"
              disabled={!cashier || saving}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--brand)]"
              checked={form.isActive}
              disabled={!cashier || saving}
              onChange={(e) =>
                setForm((f) => ({ ...f, isActive: e.target.checked }))
              }
            />
            {t('cashiers.active')}
          </label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onClose?.()}
            className="h-10 cursor-pointer"
          >
            {t('cashiers.cancel')}
          </Button>
          <Button
            type="button"
            disabled={!cashier || saving}
            onClick={handleSave}
            className="h-10 cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t('cashiers.saving')}
              </>
            ) : (
              t('cashiers.saveCashier')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
