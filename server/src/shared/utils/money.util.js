/** Round to 2 decimal places (cash / totals). */
export function money(n) {
  return Number(Number(n).toFixed(2));
}
