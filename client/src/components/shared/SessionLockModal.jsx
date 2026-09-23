import { useState } from 'react'
import { Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Session locked overlay — reusable on POS, Invoices, or any cashier screen.
 * Controlled by AuthContext.sessionLocked (manual Lock or idle timer).
 * Unlock: password only (PIN removed — not used in this deployment).
 */
export default function SessionLockModal({
  open: openProp,
  onUnlock,
} = {}) {
  const { t } = useTranslation()
  const { user, sessionLocked, unlockSession } = useAuth()
  const open = openProp ?? sessionLocked

  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  if (!open || !user) return null

  const roleLabel =
    user.role === 'admin'
      ? t('profile.roleAdmin')
      : user.role === 'cashier'
        ? t('profile.roleCashier')
        : String(user.role || '')

  // —— Unlock via POST /auth/unlock { method: 'password', value } ——
  const handleUnlock = async () => {
    setError('')
    const result = await unlockSession({ value })
    if (!result.success) {
      setError(result.error)
      return
    }
    setValue('')
    setError('')
    toast.success(t('sessionLock.unlocked'))
    onUnlock?.()
  }

  return (
    // use reusable component as much as needed — SessionLockModal (POS lock)
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-lock-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 text-center shadow-xl ring-1 ring-foreground/10">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl border border-primary/25 bg-[var(--brand-soft)] text-primary">
          <Lock className="size-6" strokeWidth={2} />
        </div>

        <h2 id="session-lock-title" className="text-xl font-bold text-foreground">
          {t('sessionLock.title')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('sessionLock.subtitle')}
        </p>

        <div className="mt-4 flex items-center gap-3 rounded-xl bg-muted/70 px-3 py-2.5 text-start">
          <Avatar className="bg-primary text-primary-foreground">
            <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
              {user.initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
        </div>

        <div className="mt-4 space-y-1.5 text-start">
          <Label htmlFor="lock-input" className="text-xs font-bold tracking-wide uppercase">
            {t('sessionLock.password')}
          </Label>
          <Input
            id="lock-input"
            type="password"
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setError('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleUnlock()
            }}
            placeholder={t('sessionLock.passwordPlaceholder')}
            className="h-11"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <Button type="button" className="mt-4 h-11 w-full text-base" onClick={handleUnlock}>
          {t('sessionLock.unlock')}
        </Button>

        {/* Switch user temporarily disabled (E2E batch) */}
      </div>
    </div>
  )
}
