# Finance insight evidence - 2026-10-18

## Scope

This is an independent implementation in Tabro, not a copy or installation of
Nudlers. Its public repository uses PolyForm Noncommercial 1.0.0; a commercial
integration needs a separate license review/permission. No Nudlers dependencies,
scrapers, MCP server, financial data or authentication configuration are imported.
References reviewed: https://github.com/enudler/nudlers and its LICENSE/package.json.

## Implemented

- One compact insights panel with category/merchant, card/source and recurring
  review tabs. Category drilldown resolves category groups, rather than searching
  a group title that does not occur in individual transactions.
- Selected-month analysis; current months use elapsed-day comparison, closed
  months compare full previous months. Calendar timestamps use Asia/Jerusalem.
- Preserve currency, installment count and connection identity through cloud and
  legacy lists. Never add USD to ILS. Invalid nonempty currency codes stay unknown;
  legacy missing codes retain the existing ILS default.
- Existing ILS budgets, salary estimates, forecasts and ILS overview exclude
  foreign currencies. Ledger/history amounts and exports identify their currency.
  Foreign rows remain accessible; no estimated FX rate is invented.
- Monthly-pattern suggestions require one charge in each of at least three
  consecutive months, compatible day/amount, and the same merchant, account,
  provider and currency. Missing card/bank account identity, installments,
  ambiguous months and bank card-settlement charges are excluded from suggestions.
- Show evidence length, next estimated date and significant price increases.
  Nothing is written automatically. Confirmation opens a reusable dialog where
  amount and next due date can be reviewed/changed, with positive-amount and
  date validation. The original imported transaction is preserved.
- Date edits listen to input as well as change, so a native date input cannot
  display a newly entered date while submitting the previous draft date.
- No database migration, new service, dependency update or bank connector change.

## Validation

- `npm run test:finance`: 36 passing tests, including executing actual dashboard
  recurring and drilldown callbacks with fake services, not production accounts.
- Full `node --experimental-strip-types --test tests/*.test.mjs`: 72 passing.
- App TypeScript, production build and new insight/review component lint pass.
  Existing PaymentDashboard/edge lint findings remain: 111/1 no-explicit-any errors,
  unchanged in count from the branch base. No claim that global lint is clean.
- Browser fixture at `/tests/fixtures/financeInsights.html` uses only fake data and
  the actual shared components. Verified tabs, category callback, ILS/USD isolation,
  HE/EN controls and 390px width without horizontal overflow. Changed amount to
  135 and due date to 2026-11-12; the confirmation callback received both values.
  Fixture has no Supabase client, credentials, user session or database writes.
- Production dependency audit: 0 findings. Full existing lockfile audit has 13
  development/build findings (8 moderate, 5 high); no forced major upgrade.
  This is not a penetration test or a security certification.

## Limits And Deployment

These changes are source/build validated, not a verified live deployment. Deploy
`finance-scraper-connect` before the frontend, so cloud transactions include
currency/installment metadata. Then publish the frontend and verify using a real
authorized account. No live financial records were modified during this work.

Totals are transaction sums, not reconciled accounting: bank settlements are not
automatically netted against their card purchases. The confirmation dialog warns
against adding an already forecasted statement item a second time. There is no
automatic recurring-plan/statement reconciliation or foreign-currency forecast.
The pattern engine is a heuristic, not AI or a guaranteed next bill. Data needs
three real months of history; imported installments remain separate from monthly
subscriptions. Known existing recurring plans are not deleted or rewritten.

This does not fix American Express access. The separately deployed, zero-traffic
Amex candidate and the production bank worker are not changed by this branch.
No actual Amex account synchronization is verified, and a public cloud preflight
previously returned WAF_BLOCKED. A Nudlers MCP configuration is not a new bank
transport and must not be represented as bypassing an institution's restriction.
