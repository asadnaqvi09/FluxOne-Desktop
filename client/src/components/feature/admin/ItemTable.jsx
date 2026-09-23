import { Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatMoney } from '@/lib/formatCurrency'
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

export default function ItemTable({ products, onOpen }) {
  const { t } = useTranslation()

  if (!products.length) {
    return <EmptyState message={t('itemsRate.emptyFiltered')} />
  }

  return (
    <div className="w-full min-w-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('itemsRate.colItemCode')}</TableHead>
            <TableHead>{t('itemsRate.colNameImage')}</TableHead>
            <TableHead>{t('itemsRate.colCategory')}</TableHead>
            <TableHead>{t('itemsRate.colSellingPrice')}</TableHead>
            <TableHead>{t('itemsRate.colDiscount')}</TableHead>
            <TableHead>{t('itemsRate.colAction')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <strong>{p.sku}</strong>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-[9px] leading-tight text-muted-foreground">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <img
                        src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Zm9vZHxlbnwwfHwwfHx8MA%3D%3D"
                        alt={t('itemsRate.productImageAlt')}
                      />
                    )}
                  </span>
                  <span className="font-medium">{p.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {p.category}
                {p.subCategory ? ` · ${p.subCategory}` : ''}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {formatMoney(p.price)}
              </TableCell>
              <TableCell>
                {p.discountPct ? `${p.discountPct}%` : t('shared.emDash')}
              </TableCell>
              <TableCell>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  className="cursor-pointer border-primary text-primary hover:bg-[var(--brand-soft)]"
                  title={t('itemsRate.editTitle', { name: p.name })}
                  aria-label={t('itemsRate.editAria', { name: p.name })}
                  onClick={() => onOpen(p)}
                >
                  <Pencil className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
