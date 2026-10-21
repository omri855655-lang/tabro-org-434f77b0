# Planning follow-up, 2026-10-21

## Implemented

- Localized Gantt controls, templates, share dialog, public viewer and advisor recovery controls in Hebrew, English, Spanish, Chinese, Arabic and Russian. Other legacy Projects/Courses screens are not fully translated yet.
- Improved responsive task/date columns and logical RTL timeline placement. Course lesson dates use the local day, and invalid calendar dates are rejected.
- Gantt updates verify returned rows; partial bulk failures reconcile only confirmed saves and report failure honestly.
- Public Gantt payloads are validated and projected to display fields. Inactive links and service failures have different states; failures support retry.
- Opening the share dialog does not create a public link. Creation requires a separate explicit action after an exposure explanation; existing disable behavior remains.
- Advisor requests have cancellation and a 30-second deadline, preserve failed prompts and avoid duplicate retry messages. TXT/Markdown/JSON plans can be reviewed locally before sending. History remains intact, with incremental display and JSON backup.

## Verification

- All 168 Node tests passed, including actual project persistence callbacks with local transports, partial/zero-row failures and report-modal input isolation.
- App TypeScript and production build passed. Targeted ESLint and diff whitespace checks passed; repository-wide legacy lint is not claimed clean.
- Browser fixture uses fictional records and injected local save/link/AI transports only. Verified failed saves, public/course read-only controls, timeout/cancel/error recovery, deduplicated retry, successful fake reply, local text-file loading, explicit link creation and disable.
- Verified all six interface languages. At 390px Hebrew viewport, document width equals viewport width; timeline scroll remains internal.
- Visible native Gantt report contains four fictional task rows, dates and localized statuses. Closing restores the app. Actual operating-system PDF output was not saved or verified.
- No production task edits, public links, AI calls, bank syncs, imports, mail, migrations, secret or IAM changes were made for these tests.

## Remaining

- Live advisor service end-to-end response and real public-link lifecycle are not proven by the injected-transport fixture.
- Direct American Express login remains blocked; imported statements are the temporary path. No new direct bank connection was attempted in this batch.
- Full legacy-screen translations, Outlook parity, broader project redesign, FocusTown parity/native blocking, mail delivery verification and development dependency security findings remain separate backlog items.
- Frontend publication and live read-only evidence are recorded separately after deployment, not inferred from a local build.

## Live follow-up

- Planning release `bc0a3db` was published through Lovable; production entry and ProjectsManager, PlanningAdvisor and CoursesManager chunks returned HTTP 200. Advisor timeout and public payload-validation markers were present in the public assets.
- The signed-in live Gantt opened for an existing project. Its report showed seven real task rows plus a header without changing tasks. Invalid public tokens showed the localized inactive-link page.
- Live testing exposed a nested Radix/native-dialog interaction: the first report click could dismiss the underlying Gantt instead of activating the report button. A follow-up makes report pointer events explicit, isolates pointer/focus input, and handles report Escape before the underlying dismiss layer. A real Radix fixture verified one-click report close and Escape both preserve the original modal and restore focus.
- Native operating-system printing/PDF output and actual AI service responses remain unverified. No public production link was created.
