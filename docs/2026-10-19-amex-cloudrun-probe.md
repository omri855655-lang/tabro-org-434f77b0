# American Express - actual Cloud Run probe - 2026-10-19

## Finding

The public login page is also refused from the actual Cloud Run service runtime,
not only from Cloud Build. No bank account has been authenticated or synchronized.
This is an additional diagnostic, not a working connector or a production fix.

The fresh GitHub API check still showed MCP main
`36f69204509d037ecbc80f7eb4250962f74f8309` (2026-05-02), scraper release 6.12.2,
and unmerged Amex PRs #1159 / #1186 with the same reviewed heads. No new upstream
fix was installed. See the previous day's source review for the MCP/2FA limits.

## Isolated Runtime Test

- Service: `tabro-finance-worker-secure`, project `tabro-finance-omri855655`,
  region `me-west1`.
- Diagnostic revision: `tabro-finance-worker-secure-amex-probe-1019`.
- Same immutable candidate image as before:
  `sha256:04eca67549782a206342ed7ed3d47ea9b4cef4872591700000138d655a8919c8`.
- Deployed with `--no-traffic`; no live user traffic was assigned to this revision.
- The standalone diagnostic source is `finance-worker/scripts/cloudrun-amex-probe.mjs`.
  It was syntax-transpiled, comments removed, and passed as a Node ESM argument
  to the existing image. No rebuild or dependency update was required.
- Source SHA-256: `5fe89cf71404a6cb66a3f6ebc2d1b64aadc45b30738643cfb79f9895abcaf908`.
  Inline argument SHA-256: `fa23d30ce6c92d573787ca231aaf1619b92fa2064415c94ef0e011d3b912333b`.
  These identify the executed version. After recording the result, the repository
  tool was additionally hardened to pass only PATH/HOME/LANG/TMPDIR to Chromium,
  rather than inheriting the worker environment. The runtime test preceded that
  hardening; it was not repeated after the confirmed block.
- The script loads only the isolated browser and public-page helpers, not the
  scraper class, worker server, Supabase client or credential decryption code.
  It navigates once to the fixed official public login URL, never fills/submits
  fields, and stops on refusal. No cookies/tokens are extracted, security scripts
  disabled, CAPTCHA solved, or automation properties hidden.
- The diagnostic HTTP server exposes only its sanitized GET /health result;
  all other requests return 404. Startup is limited to the named probe revision.

The Cloud Run revision became Ready. Its own structured log at
2026-10-19 07:44:31.473 UTC reported:

```json
{"runtime":"cloud-run","credentialFree":true,"diagnosticOnly":true,"loginFormReady":false,"httpStatus":403,"code":"WAF_BLOCKED"}
```

Cloud Run infrastructure readiness is not bank login success. No stored bank
credentials were read, no OTP sent, no financial records imported or changed.

## Restoration And Verification

- Restored the ordinary image startup by clearing the command/argument overrides,
  again using `--no-traffic`.
- Restored candidate revision: `tabro-finance-worker-secure-amex-restored-1019`,
  Ready at 2026-10-19 07:47:01 UTC; same image digest, normal worker startup.
- Removed the temporary `amex-probe-1019` tag. Diagnostic revision history remains
  available; it receives no traffic and has no tagged URL.
- Live traffic remains 100% on `tabro-finance-worker-secure-00018-qd5`.
  The private `amex-candidate` tag targets only the restored zero-traffic candidate.
- Compared the complete template spec, excluding only image/command/args, by
  hash before/after without printing secrets. Both hashes:
  `ed7ce2a2ffba4d7ffb8583cfa6f510c6943e48dc0e96167755d31fee5883a561`.
  This comparison includes environment, service identity, resource and probe settings.
- Startup command/args are empty/default again; latest restored revision is Ready.
- IAM has no public principal. Actual unauthenticated candidate /health returns
  403; Google-authenticated /health returns 200, version 0.3.0,
  `amex_engine=puppeteer-digitalv3`. The Google identity token stayed in memory,
  was never printed or saved, and redirects were refused.
- No database, scheduler, worker-secret, bank-credential, IAM permission, frontend
  or production traffic change was made.
- `npm run check` in `finance-worker`: 36 passing tests, including seven new public
  probe tests and the browser-environment allowlist. Those tests use fixtures,
  not real account logins.

## What Remains

Automatic American Express Israel connectivity is still unverified and blocked
at the public-page access stage in the tested Cloud Run environment. Do not ask
the user to repeat their password against the same failing access check, promote
the failed candidate, or advertise continuous sync as working. A next connection
attempt needs a materially changed, bank-permitted access route with verified
Israel/Amex coverage; provider catalog presence alone is not connection success.

References:
- https://github.com/mottibec/israeli-bank-mcp/issues/6
- https://github.com/eshaham/israeli-bank-scrapers/pull/1159
- https://github.com/eshaham/israeli-bank-scrapers/pull/1186
