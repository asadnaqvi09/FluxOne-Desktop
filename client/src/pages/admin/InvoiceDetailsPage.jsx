import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import PageHeader from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import SlipPreview from '@/components/feature/admin/SlipPreview'
import { useStoreProfile } from '@/hooks/useStoreProfile'

const EMPTY_FORM = {
  name: '',
  branch: '',
  address: '',
  phone: '',
  warning: '',
  returnInstructions: '',
}

export default function InvoiceDetailsPage() {
  const { t } = useTranslation()
  const { storeProfile, saveStoreProfile, isSaving, isLoading, isLoaded } =
    useStoreProfile()
  const [form, setForm] = useState(EMPTY_FORM)

  // Sync from server only after a successful load — never wipe while typing.
  useEffect(() => {
    if (!isLoaded) return
    setForm(storeProfile)
  }, [isLoaded, storeProfile])

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const isDirty =
    isLoaded && JSON.stringify(form) !== JSON.stringify(storeProfile)

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t('invoiceDetailsAdmin.nameRequired'))
      return
    }
    const result = await saveStoreProfile(form)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success(t('invoiceDetailsAdmin.savedToast'))
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title={t('invoiceDetailsAdmin.title')}
        subtitle={t('invoiceDetailsAdmin.subtitle')}
      />

      <Card className="mx-auto w-full max-w-2xl overflow-visible border-border shadow-sm">
        <CardContent className="space-y-4 overflow-visible p-5">
          {isLoading && !isLoaded ? (
            <p className="text-sm text-muted-foreground">
              {t('invoiceDetailsAdmin.loading')}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="tpl-contact" className="font-semibold">
              {t('invoiceDetailsAdmin.storeNameLabel')}
            </Label>
            <Input
              id="tpl-contact"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="h-11"
              placeholder={t('invoiceDetailsAdmin.storeNamePlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-branch" className="font-semibold">
              {t('invoiceDetailsAdmin.branchLabel')}
            </Label>
            <Input
              id="tpl-branch"
              value={form.branch}
              onChange={(e) => set('branch', e.target.value)}
              className="h-11"
              placeholder={t('invoiceDetailsAdmin.branchPlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-address" className="font-semibold">
              {t('invoiceDetailsAdmin.addressLabel')}
            </Label>
            <Input
              id="tpl-address"
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              className="h-11"
              placeholder={t('invoiceDetailsAdmin.addressPlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-phone" className="font-semibold">
              {t('invoiceDetailsAdmin.phoneLabel')}
            </Label>
            <Input
              id="tpl-phone"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              className="h-11"
              placeholder={t('invoiceDetailsAdmin.phonePlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-warning" className="font-semibold">
              {t('invoiceDetailsAdmin.warningLabel')}
            </Label>
            <Textarea
              id="tpl-warning"
              rows={3}
              value={form.warning}
              onChange={(e) => set('warning', e.target.value)}
              placeholder={t('invoiceDetailsAdmin.warningPlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-returns" className="font-semibold">
              {t('invoiceDetailsAdmin.returnInstructionsLabel')}
            </Label>
            <Textarea
              id="tpl-returns"
              rows={3}
              value={form.returnInstructions}
              onChange={(e) => set('returnInstructions', e.target.value)}
              placeholder={t('invoiceDetailsAdmin.returnInstructionsPlaceholder')}
            />
          </div>

          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !isDirty || isLoading}
            className="h-10 cursor-pointer bg-gradient-to-r from-primary to-[var(--brand-deep)] text-primary-foreground hover:opacity-95"
          >
            {t('invoiceDetailsAdmin.save')}
          </Button>

          {/* Live preview from form state — real saved/edited values, no dummy copy */}
          <SlipPreview profile={form} />
        </CardContent>
      </Card>
    </div>
  )
}
