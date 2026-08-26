# Tabro Cloud Finance Worker

This service runs `israeli-bank-scrapers` in an isolated Chromium process and writes normalized accounts and transactions to Tabro's existing Supabase tables.

## Required environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FINANCE_WORKER_SECRET`: a long random shared secret, also configured on the Edge Function.
- `FINANCE_CREDENTIALS_KEY`: a base64-encoded 32-byte AES key. Generate with `openssl rand -base64 32` and keep it stable.
- `PORT`: optional, defaults to `8080`.

## Deploy

Build the included Dockerfile on a service that supports long-running HTTP requests and at least 1 GB memory. Configure the deployed URL as the Supabase secret `FINANCE_WORKER_URL`, then deploy the `finance-scraper-connect` Edge Function.

The service exposes `GET /health`, `POST /sync`, and `POST /sync-due`. Deploy it as a private Cloud Run service. `/sync` additionally requires a timestamped HMAC signature using `FINANCE_WORKER_SECRET`; `/sync-due` is callable only by the scheduler service account through Cloud Run IAM. For automatic updates without a home computer, configure Cloud Scheduler to call `POST /sync-due` every hour. Each connection is synced only when its interval is due (six hours by default).

The worker does not initiate payments. It signs into supported institutions with credentials supplied by the user and stores those credentials encrypted at rest. This is scraper-based access, not regulated Open Banking consent.

## Supported institutions

The Edge Function exposes the banks, card companies, and clubs supported by the installed `israeli-bank-scrapers` release, including Hapoalim, Leumi, Mizrahi, Discount, Mercantile, Otsar Hahayal, Beinleumi, Massad, Yahav, Pagi, Union, MAX, Visa Cal, Isracard, Amex, Beyahad Bishvilha, and Behatsdaa.

One Zero is intentionally not exposed by the regular credentials form. Its scraper requires an interactive SMS OTP exchange before a long-term token can be issued. Add it only through a dedicated two-step endpoint that encrypts the resulting long-term token; never ask users to reverse-engineer or paste browser session data.
