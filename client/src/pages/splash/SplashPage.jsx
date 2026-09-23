import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BrandLogo } from '@/components/shared/BrandLogo'
import { ENDPOINTS } from '@/api/endpoints'
import { apiRequest } from '@/api/apiHelper'
import { PATHS } from '@/router/paths'

export default function SplashPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    const timer = setTimeout(async () => {
      try {
        const status = await apiRequest(ENDPOINTS.setup.status)
        if (cancelled) return
        if (!status?.bootstrapDone) {
          navigate(PATHS.setup, { replace: true })
          return
        }
        if (!cancelled) navigate(PATHS.login, { replace: true })
        return
      } catch {
        if (!cancelled) navigate(PATHS.setup, { replace: true })
        return
      }
    }, 2600)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [navigate])

  return (
    <section className="splash-screen flex min-h-dvh items-center justify-center overflow-hidden">
      <div className="splash-logo-wrap text-center">
        <BrandLogo size="xl" withGlow className="mx-auto animate-[logoPulse_1.8s_ease-in-out_infinite]" />
        <p className="splash-tagline mt-5 text-sm tracking-[0.12em] text-white/90 uppercase opacity-0">
          {t('splash.product')}
        </p>
        <p className="mt-3 text-xs text-white/50">{t('splash.name')}</p>
      </div>
    </section>
  )
}
