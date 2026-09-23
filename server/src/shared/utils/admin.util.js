/** Attach tax rules to an admin product payload. */
export function withTaxes(product, getTaxes) {
  if (!product) return null;
  return { ...product, taxes: getTaxes(product.id) };
}
