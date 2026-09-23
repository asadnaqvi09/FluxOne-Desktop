/** Page title + muted subtitle */
export default function PageHeader({ title, subtitle, actions = null }) {
  return (
    <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-[1.75rem] font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {actions}
    </div>
  )
}

