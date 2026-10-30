# Tabro Cloud Finance Worker

This service runs isolated Chromium sessions and writes normalized accounts and transactions to Tabro's existing Supabase tables. Existing providers keep the `@sergienko4/israeli-bank-scrapers` adapter. Amex alone uses the upstream `israeli-bank-scrapers` 6.12.2 package with Puppeteer 25.16.0. "Official" in the engine setting means the upstream open-source package, not an Amex-approved API.

This is an alternative login implementation, not a guaranteed fix for issuer blocking. A real account sync must be verified after deployment. Do not bypass issuer challenges or treat a blocked connection as successful.

## Required environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FINANCE_WORKER_SECRET`: a long random shared secret, also configured on the Edge Function.
- `FINANCE_CREDENTIALS_KEY`: a base64-encoded 32-byte AES key. Generate with `openssl rand -base64 32` and keep it stable.
- `PORT`: optional, defaults to `8080`.
- `FINANCE_BROWSER_EXECUTABLE`: Chromium executable path; the Dockerfile sets `/usr/bin/chromium`.
- `FINANCE_AMEX_ENGINE`: `official` (default) uses the isolated upstream adapter; `legacy` restores the existing Amex adapter. Other companies do not use this setting.

## Deploy

Build the included Dockerfile on a service that supports long-running HTTP requests and at least 2 GB memory. Run one request per instance: Chromium is memory-intensive, and parallel sessions from one IP increase WAF risk, especially for Amex and Isracard. Configure the deployed URL as the Supabase secret `FINANCE_WORKER_URL`, then deploy the `finance-scraper-connect` Edge Function.

The service exposes `GET /health`, `POST /sync`, and `POST /sync-due`. Deploy it as a private Cloud Run service. `/sync` additionally requires a timestamped HMAC signature using `FINANCE_WORKER_SECRET`; `/sync-due` is callable only with a valid Cloud Run identity token.

Before promoting a revision, run `node --test tests/*.test.mjs` and `npm audit`, then check the private `/health` response for `amex_engine: "official-amex"`. Verify one user-initiated Amex sync before claiming the connection works. Keep the previous Cloud Run revision available for rollback. Do not change service IAM, credential keys, scheduler settings or adapters for other providers as part of this change. The Amex adapter does not automatically retry through the legacy engine, and failed/empty responses do not replace saved data.

Production scheduling is defined in `supabase/migrations/20260913120000_schedule_finance_sync.sql`. Supabase Cron calls the `finance-sync-due` Edge Function hourly with the shared `FINANCE_CRON_SECRET`; the function mints a Google identity token and calls the private worker. The worker syncs a connection only when its configured interval is due (12 hours by default).

The worker does not initiate payments. It signs into supported institutions with credentials supplied by the user and stores those credentials encrypted at rest. This is scraper-based access, not regulated Open Banking consent.

## Supported institutions

The Edge Function exposes the banks, card companies, and clubs supported by the installed scraper release, including Hapoalim, Leumi, Mizrahi, Discount, Mercantile, Otsar Hahayal, Beinleumi, Massad, Yahav, Pagi, MAX, Visa Cal, Isracard, Amex, Beyahad Bishvilha, and Behatsdaa. Union Bank is intentionally omitted because it is no longer supported by the maintained scraper.

One Zero is intentionally not exposed by the regular credentials form. Its scraper requires an interactive SMS OTP exchange before a long-term token can be issued. Add it only through a dedicated two-step endpoint that encrypts the resulting long-term token; never ask users to reverse-engineer or paste browser session data.
