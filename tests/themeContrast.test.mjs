import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

function luminance([h, s, l]) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const rgb = [0, 8, 4].map(n => {
    const k = (n + h / 30) % 12;
    const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
test('default amber button hover has AA contrast for ordinary text', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  const base = css.match(/:root\s*\{([\s\S]*?)\}/)?.[1];
  assert.ok(base);
  const color = name => base.match(new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`)).slice(1).map(Number);
  const a = luminance(color('accent')), b = luminance(color('accent-foreground'));
  const contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  assert.ok(contrast >= 4.5, `Expected AA text contrast >= 4.5, got ${contrast.toFixed(2)}`);
});
