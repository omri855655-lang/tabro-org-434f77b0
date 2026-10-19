# Finance workspace redesign

Frontend-only reorganization of PaymentDashboard. No schema, credentials,
authentication, bank worker, recurring-payment writes or import identities changed.

## Navigation

- Overview: selected-month ILS actuals, reported liquid balance, expandable accounts
  and spending map/recent activity. No balance is invented when none is reported.
- Transactions: shared month, source/account/category/search/hidden filters, all
  existing row actions. Clearing filters also clears the insight currency scope.
- Insights: categories, merchants, sources, recurring review, refunds and coaching.
  Category/merchant drilldowns select Transactions and retain the chosen currency.
- Cash flow: existing 90-day forecast and upcoming movements, separate from actuals.
- Bank/cards: Amex CSV/Excel shortcut, other card import, expandable connection
  controls and billing-day preferences. Existing connectors remain unchanged.
- More tools: manual planning, budget/recurring, history, explicit AI chat, guides,
  clubs/vouchers. All eleven panels have corresponding accessible tab triggers.

## Summary boundaries

Actuals exclude hidden, unpaid, invalid, future and duplicate-ID rows and do not mix
currencies. Income includes explicit credits; spending is gross before credits.
The difference is labeled as a transaction difference, not a bank balance. Bank
settlements are not economically reconciled against itemized card purchases.
Refund-aware net categories remain in the existing reviewed coaching view.
Previous-month totals and average income remain available in activity details;
like-for-like elapsed-period spending comparisons remain in Insights.

Amex direct synchronization is still blocked; this redesign does not claim to fix
the provider block. CSV/Excel remains the temporary route.

## Verification

`tests/financeWorkspace.test.mjs` renders the real shared shell/summary, validates
all panel mappings, executes actual drilldown/import handlers, and checks missing
balances and currency/date exclusions. Included in `npm run test:finance`.

The browser fixture uses the same shell, summary and insights with fictional data.
Other fixture panels are navigation placeholders, not full connector tests. No
real account, financial write, credential or synchronization attempt is used.

Production publication must be separately verified; a successful local build or
Git push is not evidence that Lovable has published the new frontend.
