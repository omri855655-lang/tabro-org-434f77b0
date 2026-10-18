# Isolated Amex Candidate - 2026-10-16

## Scope

Added a separate Puppeteer core/DigitalV3 adapter for American Express only.
The existing Playwright path remains unchanged for every other exposed provider.
The original shared scraper stays pinned to 8.7.4. An explicit `legacy` switch
provides rollback; failures never fall back and resubmit bank credentials.
Amex executes in a separate child process, so its upstream Moment timezone
mutation and library state do not affect other providers in the parent worker.
Credentials travel only over private IPC; the child does not inherit service
role keys, encryption keys, DEBUG settings or other worker secrets. Child output
is discarded, the job has a deadline, and an unexpected exit is sanitized.

The alias pins `israeli-bank-scrapers-core@6.12.2`; locally reviewed source from
upstream PR #1159 is compiled into that alias during install. Puppeteer core
25.14.0 avoids vulnerable browser-download tooling. See the vendor README for
commit provenance and differences from the pending upstream PRs.

This adaptation deliberately does not hide webdriver or abort security scripts.
It uses the real OS/browser version for consistent metadata, explicit Amex API
destinations, redirect refusal, typed access-block errors and sanitized failures.
Therefore upstream success reports for automation-hiding patches do not prove
this implementation can pass the institution's access checks.

Existing database persistence, credential encryption, signed worker requests,
and private IAM are unchanged. There is no schema migration, credential
extraction, new third-party data service, or public worker exposure.

## Verification

- Clean production `npm ci --omit=dev` succeeds, including both patch/build steps.
- `npm run check`: 29 passing tests, including a real child-process startup with
  a nonexistent fixture browser path (no network or bank access).
- Actual isolated scraper class completes login/card discovery/monthly billing/
  transaction retrieval against an in-memory fake browser and API responses.
  These are mock tests, NOT a real bank login.
- Provider-router tests cover every non-Amex provider and unchanged credentials.
- All previously locked dependency versions AND integrities are unchanged.
- `npm audit --omit=dev`: zero vulnerabilities after replacing the initially
  vulnerable full Puppeteer dependency with the separately pinned core package.
- Local worker starts with Amex candidate selected: `/health` returns 200,
  version 0.3.0 and `amex_engine=puppeteer-digitalv3`.
- An unsigned local `/sync` request returns 401 before any database/bank access.
- Currency, installments and Israeli calendar-day handling are tested, including
  midnight/DST dates that otherwise shift to the preceding day in UTC.

## Cloud Verification - 2026-10-18

The user explicitly authorized Cloud Shell's Google Cloud API permission.
Cloud Shell was authorized through its UI. An expired development VM/session
needed recovery; no production service was restarted as part of that recovery.
No new bank credentials were requested, read, or submitted during this work.

- Uploaded an explicit code-only archive and verified its SHA-256 remotely:
  `cbd398a17f464714c9a8b04ac48d6c5569ca633d14d35d0f75e5dca01bed35a0`.
- Cloud Build `c4b40fc5-9716-4dee-bb9f-1873c136ca2f` in `me-west1` succeeded.
  Both existing Playwright and isolated Puppeteer smoke tests passed against
  container Chromium `155.0.8059.79`, using only a local HTML fixture.
- Built image digest:
  `sha256:04eca67549782a206342ed7ed3d47ea9b4cef4872591700000138d655a8919c8`.
- Deployed private, tagged, zero-traffic revision
  `tabro-finance-worker-secure-amex-54a82fe` using that build's image tag.
  All readiness conditions became true. An earlier malformed digest argument
  was rejected before deployment; the successful deployment used the build tag.
- Authenticated candidate `/health`: HTTP 200, version `0.3.0`,
  `amex_engine=puppeteer-digitalv3`.
- Google-authenticated but unsigned `/sync` with an empty body: HTTP 401.
  Unauthenticated candidate `/health`: HTTP 403. IAM has no `allUsers` or
  `allAuthenticatedUsers` binding.
- Compared the complete revision specs in memory without printing secrets:
  unchanged except for the image and `FINANCE_AMEX_ENGINE` flag. This includes
  existing secrets/environment, service identity, concurrency and resources.
- Re-ran `npm run check`: 29 passed. Live `npm audit --omit=dev`: zero findings.

## Actual Access Block - Not A Connectivity Fix

Credential-free Cloud Build `3c8caadd-1b25-4300-b1e1-aa64dd9d5e40`, also in
`me-west1`, ran the exact built image with the candidate browser preparation.
It only visited the public official login page; it did not invoke the scraper's
credential login path, provide identity/card/password fields, or import accounts.
Its sanitized result was:

```json
{"credentialFree":true,"loginFormReady":false,"httpStatus":403,"code":"WAF_BLOCKED"}
```

The diagnostic deliberately exited 2, so that diagnostic build is `FAILURE`.
This is a bank-origin access refusal, not an image-build or startup failure.
Cloud Build and Cloud Run do not necessarily have identical egress IPs; this is
not a real account test or a claim about every possible bank access path.
The reproducible configuration is `finance-worker/cloudbuild-amex-preflight.yaml`.

The candidate was NOT promoted. Production traffic remains 100% on
`tabro-finance-worker-secure-00018-qd5`; the candidate has only its private tag.
No frontend publication, scheduler change, database migration or IAM weakening
was performed. No live Amex account synchronization has succeeded.

Do not ask the user to repeat credentials against this failing preflight, hide
automation to evade the block, or claim the bank connection is repaired. A next
integration needs a bank-permitted access route or a provider with verified
American Express Israel coverage before switching production traffic.
