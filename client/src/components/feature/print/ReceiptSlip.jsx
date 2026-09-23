import { format } from 'date-fns'
import { FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { STORE_PROFILE } from '@/data/products'
import { formatMoney } from '@/lib/formatCurrency'
import {
  isPolicyTitleList,
  normalizeStoreForSlip,
  parsePoliciesFromReturnInstructions,
} from '@/lib/mapInvoice'

const TYPE_KEYS = {
  Sale: 'invoices.typeSale',
  Return: 'invoices.typeReturn',
  Exchange: 'invoices.typeExchange',
}

const PAYMENT_KEYS = {
  Paid: 'invoices.paymentPaid',
  Refund: 'invoices.paymentRefund',
  Return: 'invoices.paymentReturn',
  Adjust: 'invoices.paymentAdjust',
}

function translateMethod(method, t) {
  if (!method) return ''
  const lower = String(method).toLowerCase()
  if (lower === 'cash') return t('receipt.paymentCashMethod')
  return method
}

/** Printable receipt body — shared by modal + window.print */
export default function ReceiptSlip({ invoice, store }) {
  const { t } = useTranslation()
  if (!invoice) return null

  const slipStore =
    normalizeStoreForSlip(store || invoice.store) || STORE_PROFILE

  const typeLabel = t(
    TYPE_KEYS[invoice.type] || TYPE_KEYS.Sale,
  )
  const statusRaw = invoice.paymentStatus || invoice.status
  const statusLabel = PAYMENT_KEYS[statusRaw]
    ? t(PAYMENT_KEYS[statusRaw])
    : statusRaw

  const policies = parsePoliciesFromReturnInstructions(
    slipStore.returnInstructions,
  )
  const hideWarningAsTitles = isPolicyTitleList(
    slipStore.warning,
    policies,
  )
  const warning = hideWarningAsTitles
    ? null
    : slipStore.warning ||
      (policies.length ? null : t('receipt.storeWarning'))
  const fallbackReturn =
    !policies.length
      ? slipStore.returnInstructions || t('receipt.returnInstructions')
      : null

  return (
    <div
      id="print-area"
      className="receipt-slip space-y-3 bg-white p-1 text-sm text-foreground"
    >
      <div className="text-center">
        <h2 className="text-lg font-bold">{slipStore.name}</h2>
        <p className="text-muted-foreground">
          {slipStore.branch}
          <br />
          {slipStore.address}
          <br />
          {slipStore.phone}
        </p>
      </div>

      <p>
        <strong>{invoice.id}</strong>
        <br />
        {format(invoice.createdAt, 'd MMM yyyy, h:mm a')}
        <br />
        {t('receipt.cashierLine', {
          name: invoice.cashier || t('receipt.cashierFallback'),
          id: invoice.cashierId || '',
        })}
      </p>

      <table className="w-full border-collapse text-start text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="py-1 pe-2">{t('receipt.colItem')}</th>
            <th className="py-1 pe-2">{t('receipt.colId')}</th>
            <th className="py-1 pe-2">{t('receipt.colQty')}</th>
            <th className="py-1 text-end">{t('receipt.colAmt')}</th>
          </tr>
        </thead>
        <tbody>
          {(invoice.items || [])
            .filter((i) => !i.returned)
            .map((i) => (
              <tr key={i.lineId || i.sku} className="border-b border-border/60">
                <td className="py-1 pe-2">{i.name}</td>
                <td className="py-1 pe-2">{i.sku}</td>
                <td className="py-1 pe-2">{i.qty}</td>
                <td className="py-1 text-end">{formatMoney(i.unitPrice * i.qty)}</td>
              </tr>
            ))}
        </tbody>
      </table>

      <p>
        {t('receipt.actual', { amount: formatMoney(invoice.actual) })}
        <br />
        {t('receipt.discount', {
          amount: formatMoney(invoice.discount || 0),
        })}
        <br />
        {t('receipt.subTotal', { amount: formatMoney(invoice.subtotal) })}
        <br />
        {t('receipt.tax1Tax2', {
          tax1: formatMoney(invoice.tax1 || 0),
          tax2: formatMoney(invoice.tax2 || 0),
        })}
        <br />
        <strong>
          {t('receipt.total', { amount: formatMoney(invoice.total) })}
        </strong>
      </p>

      <p>
        {t('receipt.payment')}{' '}
        {(invoice.payments || [])
          .map(
            (p) =>
              `${translateMethod(p.method, t)} ${formatMoney(p.amount)}`,
          )
          .join(', ')}
        {invoice.change ? (
          <>
            <br />
            {t('receipt.amountReturned', {
              amount: formatMoney(invoice.change),
            })}
          </>
        ) : null}
      </p>

      <p className="text-muted-foreground">
        {t('receipt.typeStatus', {
          type: typeLabel || t('receipt.typeSaleFallback'),
          status: statusLabel,
        })}
      </p>

      {warning ? (
        <p className="text-muted-foreground">{warning}</p>
      ) : null}

      {policies.length > 0 ? (
        <section className="space-y-2 border-t border-border pt-3">
          <div className="flex items-center gap-2 text-primary">
            <FileText className="size-4 shrink-0" aria-hidden />
            <h3 className="text-sm font-bold">{t('receipt.companyPolicies')}</h3>
          </div>
          <ul className="space-y-2">
            {policies.map((policy, index) => (
              <li
                key={policy.name || index}
                className="flex gap-2 rounded-lg bg-muted/70 px-2.5 py-2"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0 space-y-0.5">
                  {policy.name ? (
                    <p className="text-xs font-bold text-primary">
                      {policy.name}
                    </p>
                  ) : null}
                  {policy.description ? (
                    <p className="text-[11px] leading-snug text-foreground/80">
                      {policy.description}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : fallbackReturn ? (
        <p className="text-muted-foreground">{fallbackReturn}</p>
      ) : null}

      <p className="text-muted-foreground">
        {t('receipt.contactPhone', { phone: slipStore.phone })}
      </p>
    </div>
  )
}
