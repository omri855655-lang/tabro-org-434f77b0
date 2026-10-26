# Finance repair and initial workspace audit

## User-approved scope

- Keep the existing finance structure and all controls.
- Make card monthly details and billing-day settings expandable, keeping the
  next known debit, missing-date warnings and foreign currencies visible.
- Review reimport billing-date updates before writing. Preserve categories,
  amounts and refund links. Never clear a known date with an empty input.
- Fix four-digit billing years. Reconcile recognized statement totals with
  parsed billed amounts, not original foreign purchase amounts.
- Show remaining Amex installments as separate estimates, not actual spending
  or part of the existing projected-balance total.
- User confirmed the Amex billing day is 2. No live preference or historical
  transaction has been changed during this audit.

## Changes and safeguards

`previewBillingDateChanges` is read-only. Confirming a draft re-reads matching
transactions in the user's source/card scope and checks the approved old/new date.
The update patches only metadata and compares the complete metadata snapshot to
avoid overwriting concurrent changes. Conflicts are counted and reported.

Current date correction targets stable external IDs, including statement-level
date changes such as the attached workbook. If a different export changes a
per-row date embedded in the external ID, it will not be matched by this path;
cross-format identity reconciliation still requires a separate review. Do not
claim general reimport identity migration or automatic duplicate cleanup.

Installment estimates require an issuer reference, confirmed billing date,
current/total installment numbers and a valid currency. Later reported
installments replace earlier projections. Missing references, duplicates,
conflicting counts, hidden/cancelled records or matching credits suppress
projection. Separate cards/currencies are not merged. Amounts are estimates
based on the latest installment and can change in a future issuer statement.

The actual user workbook was checked locally, without uploading it or adding its
contents to the repository. The normal importer recognized the transaction table
and its total reconciled. Synthetic XLSX regression coverage reproduces its
header/preamble shape without personal data. The read-only audit script can be
rerun against a user-supplied workbook path.

## Initial live visual audit (not an exhaustive whole-site test)

- Finance: repeated expanded card month grids and billing-day selectors dominate
  the overview. Compact expansion is approved and implemented locally.
- Projects: large hero, repeated status counts and new-project form precede the
  actual project list. Proposed: a shorter summary and collapsible creation form.
- Planner: the inspected day view opened at midnight, leaving current activity
  below the fold. Proposed: initial positioning at the current hour, with a
  full-day view still available.
- Nutrition: repeated display controls and profile entry points compete with
  the daily summary. Proposed: group display preferences under one control.
- ZoneFlow: many theme/preset controls precede focus actions; low contrast was
  visible in sound-player text. Proposed: move appearance options into a drawer
  and improve contrast without changing rooms or avatars.
- New interface additions still need complete non-Hebrew localization; existing
  finance components select Hebrew for RTL languages, including Arabic.

The last four layout proposals have NOT been applied. They require user choice.
Other screens, native-device layouts, exports, AI calls and bank sync require
further inspection; they were not certified by this pass.

## Verification and release boundary

Focused finance tests cover the old bank/card paths as well as date review,
concurrent updates, scope isolation, year parsing, XLSX reconciliation and
installment projection. Production data was not modified. No paid Lovable agent
was invoked. Saving this branch does not publish the changes to the live site.
The independent-hosting migration remains paused.

Verification on this checkpoint: 106 finance tests passed, TypeScript passed,
targeted lint passed and the production build passed. Existing large-bundle
warnings remain. Live screens were inspected read-only; the new local UI and
real database update still require end-to-end verification before release.
