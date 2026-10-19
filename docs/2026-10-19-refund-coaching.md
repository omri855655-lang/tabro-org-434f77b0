# Refund classification and budgeting education

## Behavior

The new Refunds & Savings tab separates gross spending, explicitly marked card
refunds and net spending for the selected month and currency. Refunds stay in
their received month; an earlier purchase month is not rewritten. A refund is
not treated as new earnings in the coaching model or the AI summary. Existing
gross breakdowns remain gross and are labelled accordingly; the new tab has its
own refund-aware net category breakdown.

Only imported `statement_credit: true` income records are recognized as card
refunds. A description containing "refund" is not sufficient. Legacy/unmarked
bank credits are not inferred or silently reclassified.

A unique same-merchant, same-provider/account/currency expense within the prior
180 days can be suggested, bounded by its remaining amount after confirmed
refund links. Multiple purchases, changed merchant descriptions, missing
account identity and over-refunds are left unresolved. A suggestion is never
stored automatically. Users may confirm a purchase link or instead a category
without claiming the original purchase was identified. Classification can be
cleared without deleting the expense or refund.

The actual dashboard confirmation callback validates again, asks for explicit
on-page confirmation, and updates only refund metadata in the legacy
`financial_transactions` table, filtered by both row ID and authenticated user.
It checks errors/zero updated rows before changing local state. Original dates,
amounts, import IDs and billing data remain unchanged. Reimport skipping keeps
this review metadata. No schema/worker changes are required.

Confirmed category links reduce category spending. Unclassified refunds reduce
the net total but remain a separate unassigned amount in the category view.
Negative category/month totals are legitimate for refunds on earlier purchases.

## Coaching Guardrails

Suggestions are local deterministic calculations, not claims about necessity,
usage, full account coverage or guaranteed savings. Users select a category and
0/5/10/15/20 percent what-if. Only eligible shopping/leisure or restaurant
purchases are included; marked installments and recurring commitments are
excluded. Health, housing, insurance and education cannot enter the scenario
through a conflicting subcategory.

Monetary scenarios pause if there are unresolved refunds, uncategorized expenses,
unknown currency, or possible bank-settlement/itemized-card overlap. No annual
projection from a partial month, no income shortfall inferred from absent data,
and no automatic subscription cancellation or budget changes. Existing recurring
pattern detection remains available for user review, not presumed unused bills.

Three short educational principles and a source link appear in a collapsed
panel. Educational context reviewed against the official CFPB toolkit:
https://www.consumerfinance.gov/consumer-tools/educator-tool/your-money-your-goals/toolkit/
This is general budgeting education, not investment, tax, credit or legal advice.

Opening the tab makes no AI request. The existing explicit AI chat sends only
selected-month ILS aggregates and conversation text, not the newly available
refund/purchase IDs, card suffixes or merchant history. Its prompt distinguishes
income/refunds/net spending, labels incomplete/overlapping evidence, treats data
labels as untrusted data and avoids mandatory percentage rules/product advice.
No live AI response was requested during testing.

## Limits

Matching is a conservative suggestion, not issuer-confirmed linkage. It depends
on the loaded transaction history and exact normalized merchant text. Metadata
is advisory, not an accounting journal or an atomic allocation service. Another
session editing rows concurrently may require a reload; the client reconciliation
will mark excess/invalid links unresolved, but no new database constraint is
introduced. Manual category-only confirmation does not identify an original
purchase. Other existing budgets/history/export views still retain their own
gross/income presentation; they have not all been converted to net categories.

All validation used synthetic records and in-memory services. No actual account,
AI request, live statement, production record or bank login was used. This change
is on `codex/finance-insight-evidence`, not published to the live site. Release
requires the earlier CSV/insights prerequisites and authenticated deployment.

## Validation

- 103 frontend tests passed, including 18 new coaching/refund tests.
- Actual dashboard callbacks were executed with mocked services: explicit
  confirmation/cancellation, user-scoped metadata-only writes, errors/zero rows,
  clearing classifications and aggregate-only AI context verified.
- Shared importer test also confirms reimport does not overwrite refund review
  metadata. TypeScript app check and production build pass. Standalone changed
  insights/coaching modules pass ESLint; existing PaymentDashboard lint debt and
  build chunk/static-dynamic-import warnings remain.
- Actual shared components were tested in a fake-data browser fixture: unique
  purchase confirmation, category-only confirmation, undo/reconfirm, net category
  totals and 455 ILS x 10% = 45.50 ILS scenario. English labels and a 390px mobile
  viewport were inspected with no horizontal DOM overflow.
- Screenshots retained in the task artifact directory: refund desktop,
  coaching/education desktop, and mobile scenario. No production deployment or
  live financial data validation is implied by these screenshots.
