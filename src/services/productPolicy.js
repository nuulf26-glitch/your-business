export function publicProduct(product, now = Date.now()) {
  if (product.status !== 'hidden') return true;
  const until = Date.parse(product.hiddenUntil);
  return Number.isFinite(until) && until <= now;
}
export function productPrice(product) {
  const base = Number(product.sellingPrice) || 0;
  if (product.status !== 'onSale') return base;
  if (product.salePrice !== '' && product.salePrice != null && Number.isFinite(Number(product.salePrice))) return Math.max(0,Number(product.salePrice));
  const discount = Math.min(100,Math.max(0,Number(product.discountPercent || product.discount) || 0));
  return Math.round(base * (1-discount/100)*100)/100;
}
