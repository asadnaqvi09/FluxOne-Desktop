import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import EmptyState from '@/components/shared/EmptyState'
import ActionPill from '@/components/feature/admin/ActionPill'

export default function LogTable({ logs, emptyMessage }) {
  const { t } = useTranslation()
  const empty = emptyMessage || t('activityLogs.emptyFiltersFallback')

  if (!logs.length) {
    return <EmptyState message={empty} />
  }

  return (
    <div className="w-full min-w-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('activityLogs.colDateTime')}</TableHead>
            <TableHead>{t('activityLogs.colUser')}</TableHead>
            <TableHead>{t('activityLogs.colAction')}</TableHead>
            <TableHead>{t('activityLogs.colReference')}</TableHead>
            <TableHead>{t('activityLogs.colDetail')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap">
                {format(row.at, 'd MMM yyyy, h:mm a')}
              </TableCell>
              <TableCell>
                <p className="font-semibold text-foreground">{row.actorName}</p>
                <p className="text-xs text-muted-foreground">{row.actorId}</p>
              </TableCell>
              <TableCell>
                <ActionPill action={row.action} />
              </TableCell>
              <TableCell className="whitespace-nowrap">{row.reference}</TableCell>
              <TableCell className="max-w-[280px] whitespace-normal text-muted-foreground">
                {row.detail}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
