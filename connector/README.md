# Tabro Finance Connector

This local connector imports supported Israeli bank, credit-card and consumer-club transactions into the signed-in user's Tabro account.

## Security model

- Bank credentials stay in the operating-system credential vault through `keytar`.
- The pairing token is shown once by Tabro and is also stored in the credential vault.
- Only normalized account and transaction data is sent to Tabro.
- The connector never initiates payments or changes account data.
- This scraper-based read-only behavior is not an official Open Banking permission. Review each institution's terms before use.
- Do not use reverse engineering, MITM proxies or extracted long-term authentication tokens.

## Install

Node.js 22.22.2 or newer is required.

```sh
npm install
npm run setup -- --url SUPABASE_URL --key PUBLISHABLE_KEY --token ONE_TIME_PAIRING_TOKEN
npm run add-source
npm run sync
npm run install-service
```

Use `npm run daemon` instead of `install-service` if you prefer to run it only in the current terminal.

Some institutions may request fresh authentication or block browser automation. A connector cannot sync while the computer is turned off.
