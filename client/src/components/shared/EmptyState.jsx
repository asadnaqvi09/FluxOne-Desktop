import { useTranslation } from 'react-i18next'

/** Empty list / table placeholder */
export default function EmptyState({ message, className = '' }) {
  const { t } = useTranslation()
  return (
    <p
      className={`py-12 text-center text-sm text-muted-foreground ${className}`.trim()}
    >
      {message || t('shared.emptyDefault')}
    </p>
  )
}
