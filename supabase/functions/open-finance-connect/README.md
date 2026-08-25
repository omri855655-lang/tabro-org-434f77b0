# Open Finance setup

The Edge Function keeps organization credentials server-side and uses the authenticated
Supabase user ID as Open Finance's per-user `userId`.

Required Supabase secrets:

```sh
supabase secrets set OPEN_FINANCE_CLIENT_ID=... OPEN_FINANCE_CLIENT_SECRET=...
```

Also configure `SITE_URL` and, when needed, comma-separated `APP_ORIGINS` so the callback
can safely notify the originating Tabro window. Production access must be enabled for the
Open Finance organization; use their sandbox organization while validating the flow.

The integration requests read-only account types and does not request payment-initiation
permissions. Deploy the database migration before deploying the function.
