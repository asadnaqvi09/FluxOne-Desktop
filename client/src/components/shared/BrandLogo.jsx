import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import logo from '../../../public/assets/company-logo.png'

export function BrandLogo({ className, size = 'md', withGlow = false }) {
  const { t } = useTranslation()
  const brandName = t('brand.name')
  const sizes = {
    sm: 'size-9',
    md: 'size-14',
    lg: 'size-[88px]',
    xl: 'w-[min(280px,70vw)] h-auto aspect-square',
  }

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-full',
        sizes[size],
        withGlow && 'shadow-[0_0_60px_rgba(142,35,143,0.55)]',
        className,
      )}
      aria-label={brandName}
      role="img"
    >
      <img
        src={logo}
        alt={brandName}
        width={120}
        height={120}
        className="size-full object-cover"
      />
    </div>
  )
}
