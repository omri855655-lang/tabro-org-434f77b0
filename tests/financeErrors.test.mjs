import assert from 'node:assert/strict';
import test from 'node:test';
import { financeErrorMessage } from '../src/lib/financeErrors.ts';

test('form load failures are not reported as incorrect passwords', () => {
  const result = financeErrorMessage(new Error('GENERIC: LOGIN PRE: preAction — locator.waitFor: Timeout 30000ms exceeded.'), 'he');
  assert.match(result, /טרם נבדקה/);
  assert.doesNotMatch(result, /דחתה/);
  assert.match(financeErrorMessage('GENERIC: HOME POST: login area not detected', 'he'), /טרם נבדקה/);
});
test('pre-login failures with unsubmitted credentials explain that the password was not checked', () => {
  const error = 'GENERIC: PRE-LOGIN: could not continue; credentials were not submitted';
  assert.match(financeErrorMessage(error, 'he'), /טרם נבדקה/);
  assert.match(financeErrorMessage(error, 'en'), /has not been checked/);
  assert.notEqual(financeErrorMessage(error, 'en'), financeErrorMessage('INVALID_PASSWORD', 'en'));
});
test('all supported languages sanitize raw errors and distinguish a blocked institution', () => {
  for (const lang of ['he', 'en', 'es', 'zh', 'ar', 'ru']) {
    assert.ok(financeErrorMessage('WAF_BLOCKED', lang));
    assert.notEqual(financeErrorMessage('WAF_BLOCKED', lang), financeErrorMessage('INVALID_PASSWORD', lang));
    assert.ok(!financeErrorMessage('secret credential value in raw stack trace', lang).includes('secret credential'));
  }
});
