// Round to 2 decimal places (matches server money()).
export function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

// Format PKR amounts — always 2 decimals so pay UI matches checkout math.
export function formatMoney(n) {
  const value = roundMoney(n)
  return `Rs. ${value.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// Parse money typed with grouping commas (e.g. "5,000" → 5000).
// Returns NaN when empty or invalid.
export function parseMoneyInput(raw) {
  if (raw == null) return NaN
  const cleaned = String(raw).replace(/,/g, '').trim()
  if (cleaned === '') return NaN
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : NaN
}
