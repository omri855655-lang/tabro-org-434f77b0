import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_LANGUAGES, parseAppLanguage } from '../src/lib/appLanguage.ts';

test('unsupported old language settings cannot index a missing screen dictionary', () => {
  for (const language of APP_LANGUAGES) assert.equal(parseAppLanguage(language), language);
  assert.equal(parseAppLanguage(' en-US '), 'en');
  assert.equal(parseAppLanguage('zh_CN'), 'zh');
  assert.equal(parseAppLanguage('fr'), null);
  assert.equal(parseAppLanguage('<script>'), null);
  assert.equal(parseAppLanguage(null), null);
});
