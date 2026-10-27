# Daily experience and Amex mixed-table repair

## Product changes

- Daily learning now shows a short topic draw and its actual selected topic.
  It makes one lesson request, cleans up timers, and honors reduced motion.
- Five main ZoneFlow guide groups start collapsed. Their visibility is saved
  per user on the device, with an explicit reopen/hide control. Existing guide
  content, rooms, avatars, music and timers remain unchanged.
- Food descriptions and existing manual draft items can produce an editable AI
  estimate using the existing authenticated custom endpoint. No automatic meal
  save, new AI provider, schema or key. Portion assumptions are mandatory; no
  verified manufacturer data or exact nutrition values are claimed.
- Storage getter failures in privacy-restricted contexts no longer crash reads.

## Confirmed Amex parser defect

An issuer workbook can start with an unsettled-transactions table, then contain
the billed-transactions table with different columns. The previous parser reused
the first header across both sections. This included pending purchases, used
full purchase amounts instead of installments, missed billed foreign purchases,
and failed to recognize the statement reconciliation total.

The Amex-only parser now selects the later billed header in this format,
separates the preceding pending rows, and reconciles the billed total. The
private user workbook was tested locally; it is not included in the repository.
Synthetic tests exercise the same table shape with fictional transactions.

## Existing-data repair

Reimporting the same file offers a separate review before correcting legacy
records. Matching uses reproduced old external IDs within user, provider and
card-source scope, never fuzzy merchant matching. Amounts, currencies,
installment metadata and billing dates are corrected only after approval.
Pending rows are excluded through metadata, not deleted. Database row IDs,
old external IDs, user categories and refund links are preserved.

Canonical aliases make later reimports recognize repaired rows; installment
forecasting also uses these aliases. Missing billed foreign rows are inserted
only after repair completes. Stale approvals and changed metadata/amounts are
rejected with optimistic comparisons. Conflicting or ambiguous identities
require manual review. Writes are per row, not one database transaction:
an interrupted repair must be reviewed again before further import.

Known statement mismatches require a separate acknowledgement. An absent
reconciliation total is explicitly marked unverified, not presented as a pass.

## Verification boundary

- Product unit, integration and server-rendered checks passed; see release
  handoff for the final test count. New/changed small files pass targeted lint.
- Existing large-dashboard lint debt and large-bundle build warnings remain.
- Local interactive browser verification is still blocked by the browser tool
  access limitation. AI output and production repair have not been exercised
  end-to-end. No real transactions were changed in this work.
- Live read-only inspection confirmed the saved Amex error is WAF_BLOCKED
  before credential submission. No scraper upgrade, credential retry, proxy,
  browser-cookie transfer or remote-desktop access was performed.
- A manual issuer-browser login is not an automatic connection to the cloud
  worker. The Open Banking provider still needs its own configured account.
- GitHub upload is not production publication. The independent-hosting migration
  remains paused; the paid Lovable agent is not used.
