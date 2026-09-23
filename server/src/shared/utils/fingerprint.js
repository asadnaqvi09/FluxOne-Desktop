/** Cart / invoice-line signature for exchange SAME_REPLACEMENT checks (not biometrics). */
export function lineFingerprint(items) {
  return (items || [])
    .filter((item) => Number(item.qty) > 0 && item.productId)
    .map((item) => `${item.productId}:${Number(item.qty)}`)
    .sort()
    .join('|');
}
