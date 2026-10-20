# Finance connection and recovery repair

## Observed evidence

The saved MAX connection error was `GENERIC: HOME POST: login area not detected`.
Both MAX's `/login` password tab and Isracard's official digital login page were
inspected in the browser without entering identity, password or card data.
The installed 8.7.4 pipeline definitions had empty URLs/field selectors for both.
No successful account synchronization is implied by a form-only inspection.

## Changes

- Explicit, provider-scoped password login configuration for MAX and Isracard.
  Trusted HTTPS origins and terminal HTTP blocks stop before field access. Existing
  providers, credentials storage and payment-free worker behavior are preserved.
- The edge wait is capped at 45 seconds before returning the existing pending
  response rather than exceeding browser/edge deadlines. A running job is not
  automatically resubmitted.
- Saved-connection status reads no longer require the worker health endpoint.
  Failed status refreshes preserve prior records, block duplicate mutation actions
  and expose a read-only retry. Completed background jobs refresh the ledger.
- Finance reads have deadlines and validate collection-shaped responses. Refreshes
  keep the existing screen mounted; unavailable totals are not replaced with zero.
  Recovery retains access to isolated connection/import controls.
- A root render boundary exposes native dashboard/home links instead of a white
  page. It does not clear storage, disable PIN, sign out or delete any account data.

## Verification boundary

App typecheck, production build, 114 app tests and 14 worker tests passed locally.
The root recovery UI was exercised by deliberately throwing a fictional error in
a local fixture. No real financial import, login attempt or record mutation was
used for those checks. Production deployments and real MAX/Isracard sync outcomes
must be recorded separately; source changes alone do not prove either.
