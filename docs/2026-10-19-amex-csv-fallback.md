# American Express temporary statement import

## Scope

American Express Israel (`amex`) gets a dedicated CSV / Excel entry point in
Income & Expenses -> Bank & Cards. It replaces the blocked direct-connect form
and manual sync button in the frontend with the existing manual-source workflow.
Other bank/card connectors and the finance worker are unchanged. Existing Amex
credentials, server schedules and connection records are not deleted or modified.
This is not a live connection or a fix for the issuer's HTTP 403.

## Import Behavior

- Select/create an Amex source with the card's last four digits before uploading.
- Parse Hebrew/English table headings, title preambles, UTF-8, Windows-1255,
  UTF-16LE and the existing first-worksheet Excel conversion.
- Prefer explicit ILS billing amounts. Where absent, preserve original amounts
  only with an explicit currency; never estimate an exchange rate.
- Skip malformed amounts/dates, unknown currencies, cancellations and summary
  rows; show the excluded count before confirmation. Ambiguous decimal-comma
  amounts are rejected rather than guessed.
- Categorize with Tabro's existing merchant rules and allow category review.
  Suggestions are fallible; supplied/reviewed categories remain editable.
- Preserve installment number/total when explicit. Do not invent the remaining
  installments or create recurring expenses automatically.
- Keep credits as positive `income` refund rows with `statement_credit: true`.
  Existing reports show them on the income side. Confirmed future ILS card
  charges subtract them from same-date expenses, scoped to that exact source.
  Refund-only dates do not create negative planned expenses.
- Retain transaction-specific due dates; a confirmed statement date fills only
  missing due dates. Without either, no future charge is created.
- USD/EUR/etc stay visible in the currency-aware ledger/insights but are excluded
  from the existing ILS-only budget/forecast.
- Sanitize full card and authentication fields. New Amex parsing retains only
  allowlisted metadata and a masked suffix used for matching before sanitization.
- Reuse the existing authenticated, per-user/per-source importer and uniqueness
  index. Stable issuer-reference/fallback IDs include currency, credit direction,
  installment identity and explicit due date. Repeated identical occurrences in
  one file remain separate; reimport of that same file skips stored rows and
  does not overwrite reviewed categories.

## Limits

No real Amex statement has been supplied for this change. Fixtures are synthetic,
not proof of compatibility with every issuer export. Only the first Excel sheet
is read. Files without explicit currency need the empty template (ISO currency
column) or an updated export; no data is guessed silently.

Reimport matching is scoped to the same source and parser identity. Old imports
made with a different parser, changed/missing issuer references, or importing
the same card into a different source can still overlap. Without issuer IDs,
identical purchases in partial statements cannot always be disambiguated.
Bank settlements and itemized purchases are NOT economically deduplicated;
the UI warns about their combined transaction totals. Existing incorrect manual
recurring expenses are not automatically rewritten.

## Validation

- 85 frontend tests passed, including 13 new Amex parser/import tests.
- The actual shared importer was executed with an in-memory Supabase substitute:
  stored currency, date, refund/category, metadata sanitization, duplicate
  occurrences, repeat-import skipping and per-user/source isolation verified.
- TypeScript app check and production build passed. Existing bundle-size and
  dynamic/static-import warnings remain.
- Changed standalone Amex/import components, card statement module and cloud
  connector pass ESLint. Existing `financialProviders.ts` has one pre-existing
  `no-explicit-any`; the large PaymentDashboard retains existing lint debt.
- Browser fixture used the actual Amex preview/parser/forecast with fake data,
  no database or account. Category change and date change produced 640 ILS on
  the selected 2026-11-10 date; 12.50 USD remained separate. Desktop, 390px
  mobile layout and English labels were inspected.
- No real bank login, password, transaction or production database write.

## Release State

Implemented on `codex/finance-insight-evidence`, together with its preceding
currency-aware insights work. No new schema migration or worker deployment is
required for the CSV path itself. Follow the preceding insights release notes
for the cloud-list Edge Function before releasing that combined branch.

This change has NOT been published to the live site. The available Supabase
browser session is at sign-in. Do not describe local preview or a Git push as a
successful production deployment.
