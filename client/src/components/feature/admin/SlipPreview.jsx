import { useTranslation } from 'react-i18next'

export default function SlipPreview({ profile }) {
  const { t } = useTranslation()
  const name = profile?.name?.trim() || ''
  const branch = profile?.branch?.trim() || ''
  const address = profile?.address?.trim() || ''
  const phone = profile?.phone?.trim() || ''
  const warning = profile?.warning?.trim() || ''
  const returnInstructions = profile?.returnInstructions?.trim() || ''
  const hasAny =
    name || branch || address || phone || warning || returnInstructions

  return (
    <div className="mt-2 rounded-xl border border-border bg-muted/40 p-5">
      <p className="mb-3 text-xs font-medium text-muted-foreground">
        {t('invoiceDetailsAdmin.slipPreview')}
      </p>
      {!hasAny ? (
        <p className="text-sm text-muted-foreground">
          {t('invoiceDetailsAdmin.slipPreviewEmpty')}
        </p>
      ) : (
        <>
          {name ? (
            <p className="text-base font-bold text-foreground">{name}</p>
          ) : null}
          {branch ? (
            <p className="mt-1 text-sm text-muted-foreground">{branch}</p>
          ) : null}
          {address ? (
            <p className="text-sm text-muted-foreground">{address}</p>
          ) : null}
          {phone ? (
            <p className="text-sm text-muted-foreground">{phone}</p>
          ) : null}
          {warning || returnInstructions ? (
            <div className="mt-5 space-y-2 text-sm text-foreground">
              {warning ? <p>{warning}</p> : null}
              {returnInstructions ? <p>{returnInstructions}</p> : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
