import test from 'node:test';
import assert from 'node:assert/strict';
import { parseShoppingPrice, shoppingPriceLabel, shoppingTotal } from '../src/lib/shoppingPrice.ts';
test('exact, unknown and zero prices stay distinct', () => {
  assert.deepEqual(parseShoppingPrice('', ''), { price: null, price_max: null });
  assert.equal(shoppingPriceLabel(parseShoppingPrice('0', '')), '₪0');
  assert.equal(shoppingPriceLabel(parseShoppingPrice('', '')), '');
  assert.equal(shoppingPriceLabel(parseShoppingPrice('12.50', '')), '₪12.5');
});
test('invalid ranges do not become saved prices', () => {
  for (const pair of [['', '100'], ['100', '20'], ['-1', ''], ['NaN', ''], ['Infinity', ''], ['2', '-1']]) assert.throws(() => parseShoppingPrice(...pair));
});
test('totals preserve both bounds without treating maximum as an extra cost', () => {
  assert.equal(shoppingTotal([parseShoppingPrice('10', '20'), parseShoppingPrice('5', ''), parseShoppingPrice('', '')]), '₪15 – ₪25');
  assert.equal(shoppingTotal([parseShoppingPrice('0.1', ''), parseShoppingPrice('0.2', '')]), '₪0.3');
});
