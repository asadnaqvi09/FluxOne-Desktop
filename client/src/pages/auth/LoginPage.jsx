import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Info, Loader2 } from 'lucide-react'
import { BrandLogo } from '@/components/shared/BrandLogo'
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
import { useAuth } from '@/context/AuthContext'
import { CTA_MIN_PENDING_MS, useMinPending } from '@/hooks/useMinPending'
import { ENDPOINTS } from '@/api/endpoints'
import { apiRequest } from '@/api/apiHelper'
import { PATHS } from '@/router/paths'
import { LanguageSelect } from '@/layouts/Navbar/LanguageSelect'

function createLoginSchema(t) {
  return z.object({
    userId: z.string().min(1, t('login.userIdRequired')),
    password: z.string().min(1, t('login.passwordRequired')),
  })
}

export default function LoginPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { login, acknowledgeSessionNotice } = useAuth()
  const [formError, setFormError] = useState('')
  const { pending: submitting, run } = useMinPending(CTA_MIN_PENDING_MS)
  const [sessionModal, setSessionModal] = useState(null)
  const [checkingSetup, setCheckingSetup] = useState(true)

  const loginSchema = useMemo(() => createLoginSchema(t), [t, i18n.language])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const status = await apiRequest(ENDPOINTS.setup.status)
        if (!cancelled && !status?.bootstrapDone) {
          navigate(PATHS.setup, { replace: true })
        }
      } catch {
        if (!cancelled) navigate(PATHS.setup, { replace: true })
      } finally {
        if (!cancelled) setCheckingSetup(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [navigate])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { userId: '', password: '' },
  })

  const onSubmit = async (values) => {
    setFormError('')
    const result = await run(async () => login(values))
    if (!result?.success) {
      setFormError(result?.error || t('login.loginFailed'))
      return
    }
    setSessionModal({ role: result.data.role, syncOk: Boolean(result.data.syncOk) })
  }

  const continueAfterModal = () => {
    const role = sessionModal?.role
    const sessionSynced = Boolean(sessionModal?.syncOk)
    setSessionModal(null)
    acknowledgeSessionNotice()
    if (role === 'admin') {
      navigate(PATHS.admin.logs, { replace: true })
    } else if (!sessionSynced) {
      navigate(PATHS.sync, { replace: true })
    } else {
      navigate(PATHS.openCashDrawer, { replace: true })
    }
  }

  const noticeTitle =
    sessionModal?.role === 'admin'
      ? t('login.sessionAdminTitle')
      : t('login.sessionCashierTitle')
  const noticeBody =
    sessionModal?.role === 'admin'
      ? t('login.sessionAdminBody')
      : t('login.sessionCashierBody')

  if (checkingSetup) {
    return (
      <section className="auth-screen flex min-h-dvh items-center justify-center p-6 text-sm text-muted-foreground">
        <Loader2 className="me-2 size-4 animate-spin" />
        {t('login.loading')}
      </section>
    )
  }

  return (
    <section className="auth-screen relative flex min-h-dvh items-center justify-center p-6">
      <div className="absolute top-4 end-4">
        <LanguageSelect />
      </div>

      <div className="auth-card w-full max-w-[420px] rounded-[20px] border border-border bg-card p-8 shadow-[var(--app-shadow)]">
        <BrandLogo size="lg" className="mx-auto mb-4" />

        <h1 className="text-center text-2xl font-bold text-foreground">
          {t('login.title')}
        </h1>
        <p className="mt-1 mb-6 text-center text-sm text-muted-foreground">
          {t('login.subtitle')}
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="userId" className="font-semibold">
              {t('login.userIdLabel')}
            </Label>
            <Input
              id="userId"
              autoComplete="username"
              placeholder={t('login.userIdPlaceholder')}
              className="h-11"
              {...register('userId')}
            />
            {errors.userId ? (
              <p className="text-sm text-destructive">{errors.userId.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="font-semibold">
              {t('login.passwordLabel')}
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder={t('login.passwordPlaceholder')}
              className="h-11"
              {...register('password')}
            />
            {errors.password ? (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            ) : null}
          </div>

          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

          <Button
            type="submit"
            disabled={submitting}
            className="h-11 w-full cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t('login.signingIn')}
              </>
            ) : (
              t('login.submit')
            )}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs leading-snug text-muted-foreground">
          {t('login.cloudHint')}
        </p>
      </div>

      <Dialog
        open={Boolean(sessionModal)}
        onOpenChange={(open) => {
          if (!open && sessionModal) continueAfterModal()
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <div className="mx-auto mb-1 flex size-11 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-primary">
              <Info className="size-5" />
            </div>
            <DialogTitle className="text-center">{noticeTitle}</DialogTitle>
            <DialogDescription className="text-center text-sm leading-relaxed">
              {noticeBody}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button
              type="button"
              className="h-10 w-full cursor-pointer sm:w-auto sm:min-w-40"
              onClick={continueAfterModal}
            >
              {t('login.continue')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
