import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

function formatExpiresAt(ms, emDash) {
  if (!ms) return emDash
  try {
    return format(new Date(ms), 'd MMM yyyy, h:mm a')
  } catch {
    return emDash
  }
}

/**
 * Reusable signed-in profile card — same UX for cashier & admin.
 * Editable: name + email. Locked: userId, role, login expires.
 */
export default function SignedInProfileCard({
  user,
  onSave,
  saving = false,
  className,
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    setName(user.name || '')
    setEmail(user.email || '')
  }, [user])

  const roleLabel = useMemo(() => {
    if (user?.role === 'admin') return t('profile.roleAdmin')
    if (user?.role === 'cashier') return t('profile.roleCashier')
    return String(user?.role || t('shared.emDash'))
  }, [user?.role, t])

  const expiresLabel = useMemo(
    () => formatExpiresAt(user?.sessionExpiresAt, t('shared.emDash')),
    [user?.sessionExpiresAt, t],
  )
  const displayUserId =
    user?.email || user?.userId || user?.employeeId || t('shared.emDash')

  if (!user) return null

  const handleCancel = () => {
    setEditing(false)
    setError('')
    setName(user.name || '')
    setEmail(user.email || '')
  }

  const handleSave = async () => {
    setError('')
    const nextName = String(name || '').trim()
    const nextEmail = String(email || '').trim()
    if (!nextName) {
      setError(t('profile.nameRequired'))
      return
    }
    if (nextEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setError(t('profile.invalidEmail'))
      return
    }

    const result = await onSave?.({ name: nextName, email: nextEmail })
    if (result && !result.success) {
      const msg = result.error || t('profile.updateFailed')
      setError(msg)
      toast.error(msg)
      return
    }
    setEditing(false)
    toast.success(t('profile.updated'))
  }

  return (
    // use reusable component as much as needed — SignedInProfileCard (admin + cashier)
    <Card className={cn('w-full max-w-xl border-border shadow-sm', className)}>
      <CardContent className="space-y-5 p-6">
        <div className="flex items-start gap-4">
          <Avatar className="size-16 shrink-0 bg-primary text-primary-foreground">
            <AvatarFallback className="bg-primary text-lg font-semibold text-primary-foreground">
              {user.initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-bold text-foreground">
              {user.name}
            </p>
            <p className="text-sm text-muted-foreground">{roleLabel}</p>
          </div>
          {/* Edit / Save actions — top-right of profile card (QA profile view) */}
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            {editing ? (
              <>
                <Button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="h-10 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t('profile.saving')}
                    </>
                  ) : (
                    t('profile.saveChanges')
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={handleCancel}
                  className="h-10 cursor-pointer"
                >
                  {t('profile.cancel')}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(true)}
                className="h-10 cursor-pointer"
              >
                {t('profile.editProfile')}
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <ProfileField
            label={t('profile.name')}
            editable={editing}
            value={name}
            onChange={setName}
            display={user.name}
          />
          <ProfileField label={t('profile.userId')} display={displayUserId} />
          <ProfileField label={t('profile.role')} display={roleLabel} />
          <ProfileField
            label={t('profile.email')}
            editable={editing}
            value={email}
            onChange={setEmail}
            display={user.email || t('shared.emDash')}
            type="email"
          />
          <ProfileField
            label={t('profile.loginExpires')}
            display={expiresLabel}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  )
}

function ProfileField({
  label,
  display,
  editable = false,
  value = '',
  onChange,
  type = 'text',
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-4 py-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      {editable ? (
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="h-9 max-w-[240px] bg-card text-end font-semibold"
        />
      ) : (
        <span className="truncate font-semibold text-foreground">{display}</span>
      )}
    </div>
  )
}
