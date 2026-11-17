export type ShoppingPrice = { price: number | null; price_max?: number | null };
export function parseShoppingPrice(min: string, max: string): ShoppingPrice {
  const parse = (s: string) => {
    if (!s.trim()) return null;
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0 || n > 1e12) throw new Error('invalid-price');
    return Math.round(n * 100) / 100;
  };
  const price = parse(min), price_max = parse(max);
  if (price_max !== null && (price === null || price_max < price)) throw new Error('invalid-range');
  return { price, price_max };
}
export function shoppingPriceLabel(i: ShoppingPrice) {
  if (i.price === null) return '';
  const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return i.price_max != null && i.price_max !== i.price ? `₪${fmt(i.price)} – ₪${fmt(i.price_max)}` : `₪${fmt(i.price)}`;
}
export function shoppingTotal(items: ShoppingPrice[]) {
  return shoppingPriceLabel({ price: items.reduce((s, i) => s + Math.round((i.price ?? 0) * 100), 0) / 100,
    price_max: items.reduce((s, i) => s + Math.round((i.price_max ?? i.price ?? 0) * 100), 0) / 100 });
}
