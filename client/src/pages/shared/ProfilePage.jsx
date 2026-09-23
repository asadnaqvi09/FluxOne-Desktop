import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import PageHeader from '@/components/shared/PageHeader'
import SignedInProfileCard from '@/components/shared/SignedInProfileCard'

export default function ProfilePage() {
  const { t } = useTranslation()
  const { user, updateProfile, isUpdatingProfile } = useAuth()
  if (!user) return null

  const title =
    user.role === 'admin'
      ? t('profile.titleAdmin')
      : user.role === 'cashier'
        ? t('profile.titleCashier')
        : t('profile.titleUser', { role: String(user.role || 'user') })

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={title} subtitle={t('profile.subtitle')} />
      <SignedInProfileCard
        className="mx-auto"
        user={user}
        saving={isUpdatingProfile}
        onSave={updateProfile}
      />
    </div>
  )
}
