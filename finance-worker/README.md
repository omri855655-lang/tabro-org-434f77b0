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

The service exposes `GET /health`, `POST /sync`, and `POST /sync-due`. Protect both POST routes with the `x-worker-secret` header. For automatic updates without a home computer, configure the hosting platform's scheduler to call `POST /sync-due` every hour. Each connection is synced only when its interval is due (six hours by default).

The worker does not initiate payments. It signs into supported institutions with credentials supplied by the user and stores those credentials encrypted at rest. This is scraper-based access, not regulated Open Banking consent.
