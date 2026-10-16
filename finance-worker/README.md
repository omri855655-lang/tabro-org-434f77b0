# Tabro Cloud Finance Worker

This service runs the pinned `@sergienko4/israeli-bank-scrapers` package using
Playwright Chromium and writes normalized accounts and transactions to Tabro's
existing Supabase tables. American Express has an optional, process-isolated
Puppeteer/DigitalV3 candidate described below. Neither engine guarantees that
an institution will permit automated access.

## Required environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FINANCE_WORKER_SECRET`: a long random shared secret, also configured on the Edge Function.
- `FINANCE_CREDENTIALS_KEY`: a base64-encoded 32-byte AES key. Generate with `openssl rand -base64 32` and keep it stable.
- `PORT`: optional, defaults to `8080`.

## Deploy

Build the included Dockerfile on a service that supports long-running HTTP requests and at least 2 GB memory. Run one request per instance: Chromium is memory-intensive, and parallel sessions from one IP increase WAF risk, especially for Amex and Isracard. Configure the deployed URL as the Supabase secret `FINANCE_WORKER_URL`, then deploy the `finance-scraper-connect` Edge Function.

The service exposes `GET /health`, `POST /sync`, and `POST /sync-due`. Deploy it as a private Cloud Run service. `/sync` additionally requires a timestamped HMAC signature using `FINANCE_WORKER_SECRET`; `/sync-due` is callable only with a valid Cloud Run identity token.

Production scheduling is defined in `supabase/migrations/20260913120000_schedule_finance_sync.sql`. Supabase Cron calls the `finance-sync-due` Edge Function hourly with the shared `FINANCE_CRON_SECRET`; the function mints a Google identity token and calls the private worker. The worker syncs a connection only when its configured interval is due (12 hours by default).

The worker does not initiate payments. It signs into supported institutions with credentials supplied by the user and stores those credentials encrypted at rest. This is scraper-based access, not regulated Open Banking consent.

## Supported institutions

The Edge Function exposes the banks, card companies, and clubs supported by the installed scraper release, including Hapoalim, Leumi, Mizrahi, Discount, Mercantile, Otsar Hahayal, Beinleumi, Massad, Yahav, Pagi, MAX, Visa Cal, Isracard, Amex, Beyahad Bishvilha, and Behatsdaa. Union Bank is intentionally omitted because it is no longer supported by the maintained scraper.

One Zero is intentionally not exposed by the regular credentials form. Its scraper requires an interactive SMS OTP exchange before a long-term token can be issued. Add it only through a dedicated two-step endpoint that encrypts the resulting long-term token; never ask users to reverse-engineer or paste browser session data.

## Isolated American Express Engine

American Express can use a separate Puppeteer/DigitalV3 adapter without changing
the Playwright scraper or credentials contract for any other institution.
It runs in its own child process to isolate global timezone/library changes.

- `FINANCE_AMEX_ENGINE=puppeteer-digitalv3` selects the candidate for Amex only.
- `FINANCE_AMEX_ENGINE=legacy` rolls Amex back to its previous path.
- The Docker image sets the candidate flag; a plain local Node process defaults
  to legacy unless the flag is explicitly set.
- There is no automatic fallback after authentication failure and no second
  credential submission through another engine.
- Existing account/transaction persistence, encryption, worker signatures and
  private Cloud Run IAM are unchanged. No database migration is required.
- Run `npm ci`, `npm run check` and `npm audit --omit=dev` before building.
- See `vendor/amex/README.md` for pinned upstream sources, deliberate security
  differences, and the limits of upstream live-test reports.

Local/mock tests do not establish successful bank authentication. Publish a new
Cloud Run revision without traffic first, retain the previous revision and its
configuration, then verify the candidate with a single user-initiated Amex sync.
Do not expose the private worker publicly for testing. Stop on a WAF rejection.
