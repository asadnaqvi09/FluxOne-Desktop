import { useTranslation } from 'react-i18next'
import { usePos } from '@/context/PosContext'
import ReceiptSlip from '@/components/feature/print/ReceiptSlip'
import { usePrintSlip } from '@/components/feature/print/usePrintSlip'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * Post-checkout receipt modal — slip scrolls; Print / Download / New Sale stay pinned.
 */
export default function ReceiptDialog() {
  const { t } = useTranslation()
  const { receiptInvoice, closeReceipt } = usePos()
  const { printSlip, downloadSlip } = usePrintSlip()
  const open = Boolean(receiptInvoice)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeReceipt()
      }}
    >
      <DialogContent
        className="flex max-h-[min(90dvh,720px)] flex-col gap-3 overflow-hidden sm:max-w-md"
        showCloseButton
      >
        <DialogHeader className="shrink-0 pe-8">
          <DialogTitle>
            {t('receipt.dialogTitle', { id: receiptInvoice?.id || '' })}
          </DialogTitle>
        </DialogHeader>

        <div className="receipt-scroll min-h-0 flex-1 overscroll-contain">
          <ReceiptSlip
            invoice={receiptInvoice}
            store={receiptInvoice?.store}
          />
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => printSlip(receiptInvoice?.id)}
            >
              {t('receipt.print')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadSlip(receiptInvoice)}
            >
              {t('receipt.download')}
            </Button>
          </div>

          <Button type="button" onClick={closeReceipt}>
            {t('receipt.newSale')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
