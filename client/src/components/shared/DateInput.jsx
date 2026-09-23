import { Input } from '@/components/ui/input'

/** Shared select look for invoice / log / item filter bars. */
export const FILTER_SELECT_CLASS =
  'h-10 cursor-pointer rounded-lg border border-border bg-background px-2 text-sm text-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50'

/** Native date picker shown as dd/mm/yyyy. Empty value means “all dates”. */
export default function DateInput({ value, onChange, title, className }) {
  return (
    <Input
      type="date"
      lang="en-GB"
      value={value}
      onChange={onChange}
      title={title}
      className={className}
    />
  )
}
