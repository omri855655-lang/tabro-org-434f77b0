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

## Not Yet Verified / Deployed

No new bank credentials were requested, read, or submitted during this work.
No live account synchronization has succeeded with the candidate.
No Docker image was built locally (Docker is unavailable), and no new Cloud Run
revision was deployed. The Cloud Run console opened without loading project/
service content; activating Cloud Shell also did not load a shell. No active
local gcloud executable was available. User sign-in/service access was requested
asynchronously while local work continued.

Production remains on its previous worker revision. Next: regain deployment
access, build a no-traffic revision using the existing private service identity
and secrets, inspect health and startup, then perform one user-initiated Amex
trial. Retain revision 00018-qd5 for rollback. If the institution still rejects
the browser, stop: this code is a candidate, not a confirmed connectivity fix.
