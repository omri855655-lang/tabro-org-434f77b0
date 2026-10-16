# Isolated American Express adapter

This directory is used only by the separately named `amex-scraper` npm alias.
It never overwrites `@sergienko4/israeli-bank-scrapers` or its provider registry.

## Provenance

The DigitalV3 implementation and mapping are adapted from:

- https://github.com/eshaham/israeli-bank-scrapers/pull/1159
- Repository: `geriamir/israeli-bank-scrapers`
- Reviewed commit: `41021421497a531493d8c569c453f29db0cd0997`
- Original paths: `src/scrapers/amex.ts`,
  `src/scrapers/base-isracard/base-isracard.ts`, and
  `src/scrapers/base-isracard/base-isracard-utils.ts`.
- Original MIT license is preserved in `LICENSE`.

The browser-version/client-hint consistency approach was informed by PR #1186:
https://github.com/eshaham/israeli-bank-scrapers/pull/1186
Reviewed head: `7708d9fba17d7e6927e32ee41ba6f1a980616f04`.

## Deliberate Differences

This is NOT an unchanged installation of either pending PR. In particular:

- No security script is aborted or disabled.
- No `navigator.webdriver`, plugin or language spoofing is installed.
- Browser metadata retains the actual operating system and Chromium version.
- No proxy, CAPTCHA solver, saved browser profile, or extracted session token.
- Login and API traffic is restricted to explicit official Amex origins/paths.
- Redirects on API POSTs fail closed; HTTP 403/429 and challenge pages stop.
- Request/response bodies and raw login responses are not logged or returned.
- Unknown login states are not mislabeled as an incorrect password.
- A zero-card response is a failed sync, not a successful empty import.
- Bank calendar dates are restored in the adapter before shared persistence.

Because the automation-hiding parts of the upstream PRs are not used, their
authors' successful live runs are NOT evidence that this adaptation can pass
the institution's access checks. A real account test is still required. If the
institution rejects this browser, stop rather than repeatedly submit credentials.

## Build

`scripts/build-amex-adapter.mjs` compiles these reviewed local sources into the
isolated npm alias after `npm ci`. No GitHub code is downloaded at runtime or
installation time. The package alias and lockfile pin the base library; the
Puppeteer core version is pinned separately to avoid vulnerable download tooling.
