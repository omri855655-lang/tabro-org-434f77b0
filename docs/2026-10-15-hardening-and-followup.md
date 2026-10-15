# Hardening and follow-up - 2026-10-15

## Implemented

- Remove task-title HTML interpolation from planner drag previews.
- Separate public Gantt tokens from task-submission tokens. Gantt sharing is
  opt-in, independently revocable, and limited to the public report payload.
  Previously issued Gantt URLs must be recreated; task-submission URLs are unchanged.
- Use private Realtime channels with authenticated room membership checks.
  Friend-room checks use a narrowly scoped definer function so ordinary room
  SELECT restrictions do not prevent invited members from subscribing.
- Shared six-seat avatar room for personal and Together sessions; collapsible
  people panel, scoped keyboard navigation, bounded coordinates, activity desks.
  Remove simulated named participants from the personal room. Voice chat is not implemented.
- Translate room controls, planning advisor, personal journal and focus scheduling
  into Hebrew, English, Spanish, Chinese, Arabic and Russian. This is NOT a claim
  that every existing screen is fully translated.
- Isolate local journal, schedule, learning and advisor state when accounts change.
- Fix LearningStudio's AI request field (customPrompt, not prompt), reset its
  running timer when generating another lesson, and guard repeated completion.
- Lazy-load six heavier workspace sections and keep failures inside the panel.
- Update vulnerable dependencies, remove unused PWA tooling, keep actual push
  service worker support. SheetJS comes from the official 0.20.3 distribution.
- Render decoded news entities as text and add Chinese article translation.

## American Express

The real attempt logged at 2026-10-15 08:57 UTC failed before credentials were
filled: preAction waited for #flip on the marketing homepage. Changing the login
configuration URL had not changed the pipeline's initial bank URL. Patch both
the initial URL and explicit preAction navigation; wait for the password controls.
A behavioral regression test covers navigation before selector access.

The retry on revision 00017-khj still timed out waiting for the public password
controls at 09:07 UTC. The same official page exposes them in the normal browser.
No successful account import is verified. Cloud access restrictions are a possible
cause, not yet a proven diagnosis. UI now refreshes failed attempts, displays error
status even for one-time imports, sanitizes errors in all six languages, and bounds
network waits instead of leaving the connection button indefinitely busy.

Do not claim a successful account synchronization until a real attempt imports
accounts/transactions. OTP continuation and upstream anti-automation restrictions
remain separate possible blockers, not incorrect-password evidence.

## Validation And Limits

- App TypeScript and production build pass after Vite 6.4.4 / React Router 7.18.4.
- Finance import tests: 15 passing; focused frontend tests: 20 passing;
  worker tests: 7 passing.
- Browser-runtime audit and worker production audit: 0 reported vulnerabilities.
- Full app audit: 14 development/build dependency findings (9 moderate, 5 high),
  no critical findings. Tailwind 3 / braces / PostCSS and legacy tooling need a
  separately tested build-system migration; no forced incompatible upgrades.
- This is a code/dependency review, not a full penetration test or security certification.
- A fresh hosted security scan found no critical issues, one warning about disabled
  leaked-password protection, and two informational public-content/storage findings.
  Public landing content is intentional. An additional migration restricts email
  asset catalog listing to admins without changing public logo URLs.
- Still outstanding: full legacy-screen localization, complete Outlook-style
  invitations/calendar workflows, voice interaction, and system-level scheduled
  blocking while the browser is closed. Do not imply these are implemented.
