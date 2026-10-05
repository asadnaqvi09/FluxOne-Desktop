/**
 * Pure helpers for variant parent → child resolution.
 * Prefer reusable calls from VariantPickerDialog / search — no React here.
 */

/** Unique option axes from children, sorted by sortOrder then typeName. */
export function collectOptionAxes(children = []) {
  const byType = new Map()
  for (const child of children) {
    const options = Array.isArray(child.variantOptions) ? child.variantOptions : []
    for (const opt of options) {
      const typeName = String(opt?.typeName || opt?.type_name || '').trim()
      const valueName = String(opt?.valueName || opt?.value_name || '').trim()
      if (!typeName || !valueName) continue
      const sortOrder = Number(opt?.sortOrder ?? opt?.sort_order ?? 0)
      if (!byType.has(typeName)) {
        byType.set(typeName, { typeName, sortOrder, values: new Map() })
      }
      const axis = byType.get(typeName)
      axis.sortOrder = Math.min(axis.sortOrder, sortOrder)
      if (!axis.values.has(valueName)) {
        axis.values.set(valueName, { valueName, sortOrder })
      }
    }
  }
  return [...byType.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.typeName.localeCompare(b.typeName))
    .map((axis) => ({
      typeName: axis.typeName,
      values: [...axis.values.values()].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.valueName.localeCompare(b.valueName),
      ),
    }))
}

/** Resolve one child whose options match every required axis selection. */
export function resolveChildBySelection(children = [], selection = {}, axes = []) {
  const requiredTypes = axes.length
    ? axes.map((a) => a.typeName)
    : Object.keys(selection).filter((k) => selection[k])
  if (!requiredTypes.length) return null
  if (requiredTypes.some((typeName) => !selection[typeName])) return null

  return (
    children.find((child) => {
      const options = Array.isArray(child.variantOptions) ? child.variantOptions : []
      return requiredTypes.every((typeName) =>
        options.some((opt) => {
          const t = String(opt?.typeName || opt?.type_name || '')
          const v = String(opt?.valueName || opt?.value_name || '')
          return t === typeName && v === selection[typeName]
        }),
      )
    }) || null
  )
}

export function childDisplayName(child) {
  if (!child) return ''
  const label = child.variantLabel ? ` — ${child.variantLabel}` : ''
  return `${child.name || ''}${label}`.trim()
}
