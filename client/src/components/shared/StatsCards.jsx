import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** Four KPI cards in one row. Hover: scale up + purple background + white text. */
export default function StatsCards({ cards, interactive = true }) {
  return (
    <div className="grid grid-cols-4 gap-3 overflow-visible">
      {(cards || []).map((c) => (
        <Card
          key={c.key || c.label}
          className={cn(
            'min-w-0 overflow-visible border-border bg-card text-card-foreground shadow-sm',
            interactive &&
              'origin-center cursor-pointer transition-all duration-200 ease-out hover:z-10 hover:scale-105 hover:border-primary hover:bg-primary hover:text-white hover:shadow-md',
          )}
        >
          <CardContent className="p-3 sm:p-4">
            <div
              className={cn(
                'truncate text-[10px] font-medium tracking-wide text-muted-foreground uppercase sm:text-xs',
                interactive && 'group-hover/card:text-white/80',
              )}
            >
              {c.label}
            </div>
            <div
              className={cn(
                'mt-1 truncate text-lg font-bold text-foreground sm:text-xl',
                interactive && 'group-hover/card:text-white',
              )}
            >
              {c.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
