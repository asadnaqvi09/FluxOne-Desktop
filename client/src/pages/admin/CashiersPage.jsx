import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import PageHeader from '@/components/shared/PageHeader'
import CurrentCashierCard from '@/components/feature/admin/CurrentCashierCard'
import EmployeePicker from '@/components/feature/admin/EmployeePicker'
import EditCashierDialog from '@/components/feature/admin/EditCashierDialog'
import { useAdminCashiers } from '@/hooks/useAdminCashiers'
import { useMinPending } from '@/hooks/useMinPending'


export default function CashiersPage() {
  const { t } = useTranslation()
  const {
    assignedCashier,
    assignedCashierId,
    cashiers,
    assignCashier,
    updateCashier,
    isAssigning,
    isUpdating,
  } = useAdminCashiers()
  const { pending: assignPending, run: runAssign } = useMinPending(500)
  const { pending: editPending, run: runEdit } = useMinPending(500)
  const [selectedId, setSelectedId] = useState(assignedCashierId)
  const [editTarget, setEditTarget] = useState(null)

  useEffect(() => {
    setSelectedId(assignedCashierId)
  }, [assignedCashierId])

  // Handle confirm
  const handleConfirm = async () => {
    await runAssign(async () => {
      const result = await assignCashier(selectedId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(t('cashiers.assignedToast', { name: result.data.name }))
    })
  }

  // Handle save edit
    const handleSaveEdit = async (patch) => {
    if (!editTarget?.id) {
      return { success: false, error: t('cashiers.selectToEdit') }
    }
    let outcome = { success: false, error: t('cashiers.updateFailed') }
    await runEdit(async () => {
      const result = await updateCashier(editTarget.id, patch)
      if (!result.success) {
        outcome = result
        return
      }
      outcome = { success: true, data: result.data }
      toast.success(t('cashiers.updatedToast', { name: result.data.name }))
      setEditTarget(null)
    })
    return outcome
  }

  const confirming = isAssigning || assignPending
  const saving = isUpdating || editPending

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* Page header */}
      <PageHeader
        title={t('cashiers.title')}
        subtitle={t('cashiers.subtitle')}
      />

      {/* Current cashier */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
        <CurrentCashierCard cashier={assignedCashier} />
        {/* Employee picker */}
        <EmployeePicker
          cashiers={cashiers}
          selectedId={selectedId}
          assignedId={assignedCashierId}
          onSelect={setSelectedId}
          onConfirm={handleConfirm}
          onEdit={setEditTarget}
          confirming={confirming}
        />
      </div>

      {/* Edit cashier dialog */}
      <EditCashierDialog
        open={Boolean(editTarget)}
        cashier={editTarget}
        saving={saving}
        onClose={() => setEditTarget(null)}
        onSave={handleSaveEdit}
      />
    </div>
  )
}
