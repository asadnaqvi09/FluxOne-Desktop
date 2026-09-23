import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { SUPPORTED_LANGS } from '@/i18n'

function normalizeLang(lng) {
  if (!lng) return 'en'
  const base = String(lng).split('-')[0]
  return SUPPORTED_LANGS.includes(base) ? base : 'en'
}

// Navbar language control — Eng / Urdu; persists via i18n languageChanged.
export function LanguageSelect({ locked = false }) {
  const { i18n, t } = useTranslation()
  const value = normalizeLang(i18n.resolvedLanguage || i18n.language)

  const onChange = (e) => {
    const lng = e.target.value
    if (!SUPPORTED_LANGS.includes(lng)) return
    void i18n.changeLanguage(lng)
  }

  return (
    <div className="relative">
      <select
        aria-label={t('language.ariaLabel')}
        disabled={locked}
        value={value}
        onChange={onChange}
        className={cn(
          'h-9 cursor-pointer appearance-none rounded-lg border border-border bg-background py-1.5 pe-8 ps-2.5 text-sm text-foreground',
          'disabled:cursor-not-allowed disabled:opacity-60',
        )}
      >
        <option value="en">{t('language.eng')}</option>
        <option value="ur">{t('language.urdu')}</option>
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 end-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}
