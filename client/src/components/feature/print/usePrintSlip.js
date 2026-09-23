import { toast } from 'sonner'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import i18n from '@/i18n'
import { desktopPrint, isDesktopApp } from '@/lib/desktop'
import { prepareCloneForHtml2Canvas } from '@/lib/safeCssColor'

const SLIP_WIDTH_MM = 80
const SLIP_PAD_MM = 4

/**
 * Print / download helpers for invoice slips.
 * Print = HTML + CSS (same look as modal).
 * Download = screenshot of #print-area into a receipt-sized PDF.
 */
export function usePrintSlip() {
  const printSlip = async (invoiceId) => {
    if (isDesktopApp()) {
      const result = await desktopPrint()
      if (result.success) {
        toast.success(i18n.t('receipt.printDialogOpened'))
      } else if (result.error) {
        toast.error(result.error)
        window.print()
      } else {
        window.print()
        toast.success(i18n.t('receipt.printDialogOpened'))
      }
    } else {
      window.print()
      toast.success(i18n.t('receipt.printDialogOpened'))
    }
    if (invoiceId) {
      // Phase 3: optionally log print event to notifications API
    }
  }

  const downloadSlip = async (invoice) => {
    if (!invoice) return

    const slip = document.getElementById('print-area')
    if (!slip) {
      toast.error(i18n.t('receipt.receiptNotReady'))
      return
    }

    const restoreOverflow = unclipForCapture(slip)
    const loadingId = toast.loading(i18n.t('receipt.preparingPdf'))

    try {
      await new Promise((resolve) => requestAnimationFrame(() => resolve()))

      const canvas = await html2canvas(slip, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: slip.scrollWidth,
        windowHeight: slip.scrollHeight,
        onclone: (clonedDoc, cloned) => {
          prepareCloneForHtml2Canvas(slip, clonedDoc, cloned)
        },
      })

      const img = canvas.toDataURL('image/png')
      const contentWidth = SLIP_WIDTH_MM - SLIP_PAD_MM * 2
      const contentHeight = (canvas.height / canvas.width) * contentWidth
      const pageHeight = contentHeight + SLIP_PAD_MM * 2

      const doc = new jsPDF({
        unit: 'mm',
        format: [SLIP_WIDTH_MM, Math.max(120, pageHeight)],
        compress: true,
      })

      doc.addImage(img, 'PNG', SLIP_PAD_MM, SLIP_PAD_MM, contentWidth, contentHeight)

      const filename = `${invoice.id}.pdf`
      doc.save(filename)
      toast.success(i18n.t('receipt.downloaded', { filename }))
    } catch (err) {
      console.error('downloadSlip failed', err)
      toast.error(err?.message || i18n.t('receipt.couldNotDownload'))
    } finally {
      restoreOverflow()
      toast.dismiss(loadingId)
    }
  }

  return { printSlip, downloadSlip }
}

/** Parents use overflow/max-height, which would crop the screenshot. */
function unclipForCapture(el) {
  const changed = []
  let node = el.parentElement

  while (node && node !== document.body) {
    changed.push({
      node,
      overflow: node.style.overflow,
      overflowY: node.style.overflowY,
      maxHeight: node.style.maxHeight,
    })
    node.style.overflow = 'visible'
    node.style.overflowY = 'visible'
    node.style.maxHeight = 'none'
    node = node.parentElement
  }

  return () => {
    for (const item of changed) {
      item.node.style.overflow = item.overflow
      item.node.style.overflowY = item.overflowY
      item.node.style.maxHeight = item.maxHeight
    }
  }
}
