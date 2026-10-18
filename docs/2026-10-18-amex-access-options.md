# American Express Israel Access Options - 2026-10-18

## Current Finding

The exact candidate image passed both container browser smoke tests and private
Cloud Run startup/security checks. Its credential-free public-login preflight
in Cloud Build returned HTTP 403 / `WAF_BLOCKED`. No credentials were submitted.
The candidate is not promoted; production traffic remains on revision 00018-qd5.
See `2026-10-16-isolated-amex-adapter.md` for immutable build IDs and evidence.

No working automatic American Express Israel connection has been verified.
Do not interpret an available library, successful browser launch, catalog entry,
or a vendor's generic "all cards" claim as successful account connectivity.

## Options Checked

### Pending Open-Source Changes

Upstream PR 1186 remains open. It reports successful user tests, but includes
automation hiding not present in our adaptation. That is not a new verified fix
for our deployed cloud environment. No additional bank login was attempted.

Source: https://github.com/eshaham/israeli-bank-scrapers/pull/1186

### Direct Israeli Issuer API

The Israeli issuer's portal explicitly covers Isracard and American Express.
It describes access for organizations with the relevant regulatory certificate,
not a public personal API key that Tabro can simply generate.
The international Amex developer portal must not be assumed to cover Israeli
cards: its documented PSD2 account/transaction entities include the UK/France.

Sources:
- https://marketing.isracard.co.il/developer-portal/
- https://developer.americanexpress.com/open-banking

### Financy / Open-Finance.ai

The current self-service documentation offers API access on paid plans. Bank
linking happens in Financy's UI; programmatic consent creation belongs to a
separate B2B offering. Its reference-provider catalog requires authentication.
The public pages reviewed list Isracard but do not establish explicit support
for this user's Israeli American Express card.

Practical next check: if the user chooses Financy, first confirm actual Amex
availability and a successful read-only consent in its UI on a free account,
without buying API access. Only after that evidence should a paid API plan be
considered, with separate approval for the actual price and subscription terms.
No account, subscription, consent or payment was created during this work.

For personal Financy credentials, the provider-supplied `userId` in Settings/API
must be used. Do not silently substitute a Tabro auth UUID. Keep the key in
read-only/data-only mode; this task does not need payment/invoicing permissions.

Sources:
- https://docs-financy.open-finance.ai/docs/getting-started
- https://docs-financy.open-finance.ai/docs/authentication
- https://docs-financy.open-finance.ai/docs/connections
- https://docs-financy.open-finance.ai/docs/providers-branches
- https://financy.open-finance.ai/
- https://github.com/open-finance-ai/financy

The existing `open-finance-connect` Edge Function creates `/v2/connections` and
uses the Tabro user ID. This has NOT been validated against a contracted B2B
account. It must not be presented as compatible with standard personal Financy
credentials merely because two environment variables exist. The existing live
function was not changed or redeployed while researching alternatives.

### Finanda

The current getting-started page says Smart Aggregation is a closed Enterprise
offering for large-scale organizations, without a small-project self-service
API route. Its old public GitHub reference project is not evidence of current
self-service availability. It is not an immediately usable replacement here.

Source (read in the browser because the site requires JavaScript):
https://docs.finanda.com/getting-started

### Existing Statement Import

Statement import remains a non-live fallback, not a repaired bank connection.
No user statements were imported or altered during this investigation.

## Safe Provider-Catalog Probe

Added `scripts/check-open-finance-access.mjs`, independent of production code.
It requires Node 20+ and no new packages. It does not load .env files or save
credentials, tokens, provider data, account data or browser profiles to disk.

Configuration inputs, supplied privately in the process environment:
- `OPEN_FINANCE_CLIENT_ID`
- `OPEN_FINANCE_CLIENT_SECRET`
- `OPEN_FINANCE_USER_ID` (provider-issued identity for a personal Financy account)

```sh
node scripts/check-open-finance-access.mjs --check-config
node scripts/check-open-finance-access.mjs --live
node --test tests/openFinanceAccess.test.mjs
```

`--check-config` makes no network calls. `--live` uses only authentication and
`GET /v2/providers?includeFakeProviders=false` on the fixed official API origin.
It refuses redirects, bounds response size/time, never logs upstream error
bodies, and does not retry authentication. It has no payment, paid-refresh,
consent-creation, connection-deletion, account or transaction request path.

An explicit catalog match returns `AMEX_LISTED_NOT_CONNECTION_VERIFIED`.
Isracard by itself does not count as an Amex match. Lack of an explicit match
is not proof that the vendor cannot support an Amex card via another documented
issuer journey; that needs vendor confirmation and a real consent test.

Local configuration currently lacks all three inputs. This is a local-process
check, not a claim about Supabase's secret configuration. No live vendor probe
was performed. Tests use fake credentials and in-memory HTTP responses only.
