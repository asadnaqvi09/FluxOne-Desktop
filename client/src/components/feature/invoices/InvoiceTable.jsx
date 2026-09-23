import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { formatMoney } from '@/lib/formatCurrency'
import { PATHS } from '@/router/paths'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import EmptyState from '@/components/shared/EmptyState'
import { TypePill, PaymentStatusPill } from '@/components/feature/invoices/InvoiceStatusPills'

/**
 * Invoice list table — spacious rows matching figma Inovices1 / Inovices2.
 */
export default function InvoiceTable({
  invoices,
  emptyMessage,
  onReprint,
  onReturn,
  onExchange,
  onPrevExchange,
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const empty = emptyMessage || t('invoices.emptyFiltersFallback')

  if (!invoices.length) {
    return <EmptyState message={empty} />
  }

  return (
    <div className="w-full min-w-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-11 px-3">{t('invoices.colInvoiceId')}</TableHead>
            <TableHead className="h-11 px-3">{t('invoices.colDateTime')}</TableHead>
            <TableHead className="h-11 px-3">{t('invoices.colItems')}</TableHead>
            <TableHead className="h-11 px-3">{t('invoices.colSubTotal')}</TableHead>
            <TableHead className="h-11 px-3">{t('invoices.colDiscount')}</TableHead>
            <TableHead className="h-11 px-3">{t('invoices.colTax')}</TableHead>
            <TableHead className="h-11 px-3">{t('invoices.colTotalPrice')}</TableHead>
            <TableHead className="h-11 px-3">{t('invoices.colType')}</TableHead>
            <TableHead className="h-11 px-3">{t('invoices.colPaymentStatus')}</TableHead>
            <TableHead className="h-11 px-3">{t('invoices.colActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => {
            const type = inv.type || 'Sale'
            const pay = inv.paymentStatus || 'Paid'
            return (
              <TableRow
                key={inv.id}
                className="hover:bg-[var(--brand-soft)]/40"
              >
                <TableCell className="px-3 py-3.5">
                  <strong>{inv.id}</strong>
                </TableCell>
                <TableCell className="px-3 py-3.5 whitespace-normal">
                  <span className="block leading-snug">
                    {format(inv.createdAt, 'd MMM yyyy,')}
                  </span>
                  <span className="block text-muted-foreground leading-snug">
                    {format(inv.createdAt, 'h:mm a')}
                  </span>
                </TableCell>
                <TableCell className="max-w-[220px] px-3 py-3.5 whitespace-normal">
                  <span className="line-clamp-2 leading-snug">
                    {typeof inv.items === 'string'
                      ? inv.items || inv.itemsSummary || t('shared.emDash')
                      : (inv.items || [])
                          .filter((i) => !i.returned)
                          .map((i) => i.name)
                          .join(', ') ||
                        inv.itemsSummary ||
                        t('shared.emDash')}
                  </span>
                </TableCell>
                <TableCell className="px-3 py-3.5 whitespace-nowrap">
                  {formatMoney(inv.subtotal || 0)}
                </TableCell>
                <TableCell className="px-3 py-3.5 whitespace-nowrap">
                  {formatMoney(inv.discount || 0)}
                </TableCell>
                <TableCell className="px-3 py-3.5 whitespace-nowrap">
                  {formatMoney(inv.tax || 0)}
                </TableCell>
                <TableCell className="px-3 py-3.5 whitespace-nowrap">
                  {formatMoney(inv.total)}
                </TableCell>
                <TableCell className="px-3 py-3.5">
                  <TypePill type={type} />
                </TableCell>
                <TableCell className="px-3 py-3.5">
                  <PaymentStatusPill status={pay} />
                </TableCell>
                <TableCell className="px-3 py-3.5 whitespace-normal">
                  <div className="flex min-w-[240px] flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => navigate(PATHS.invoiceDetail(inv.id))}
                    >
                      {t('invoices.actionView')}
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => onReprint(inv)}
                    >
                      {t('invoices.actionPrint')}
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => onExchange(inv)}
                    >
                      {t('invoices.actionExchange')}
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => onPrevExchange(inv)}
                    >
                      {t('invoices.actionPrevExchange')}
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => onReturn(inv)}
                    >
                      {t('invoices.actionReturn')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
