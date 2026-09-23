import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en/translation.json'
import ur from './locales/ur/translation.json'

export const LANG_STORAGE_KEY = 'fluxone_lang'
export const SUPPORTED_LANGS = ['en', 'ur']

function readSavedLang() {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY)
    if (saved && SUPPORTED_LANGS.includes(saved)) return saved
  } catch {
    // localStorage blocked
  }
  return 'en'
}

/** Apply html lang + dir for LTR (en) / RTL (ur). */
export function applyDocumentDirection(lng) {
  const lang = lng?.startsWith('ur') ? 'ur' : 'en'
  const root = document.documentElement
  root.lang = lang
  root.dir = lang === 'ur' ? 'rtl' : 'ltr'
}

const initialLng = readSavedLang()
applyDocumentDirection(initialLng)

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ur: { translation: ur },
  },
  lng: initialLng,
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LANGS,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
})

i18n.on('languageChanged', (lng) => {
  applyDocumentDirection(lng)
  try {
    const lang = lng?.startsWith('ur') ? 'ur' : 'en'
    localStorage.setItem(LANG_STORAGE_KEY, lang)
  } catch {
    // ignore
  }
})

export default i18n
