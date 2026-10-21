# Backlog batch: calendar export, learning and reliable news

## Scope

- Calendar export now uses UTC instants, date-only all-day events, escaped text,
  bounded optional alarms and UTF-8 line folding. This does not add invitations,
  attendee responses or complete Outlook compatibility.
- Learning has six-language controls, category/path labels, searchable history,
  lesson review, JSON backup and owner-scoped cloud sync with local fallback.
  The UI loads the latest 1,000 entries. No cloud history is deleted at that limit.
- Good news preserves the last successful response across day changes and shows
  its refresh date. RSS and Atom links are parsed safely. Five English feeds and
  a direct Hebrew good-news source link remain distinct; a Hebrew feed is not
  claimed to be aggregated.
- News parsing stays on the v4 API but pins patched `fast-xml-parser@4.5.7`,
  disables entity expansion, rejects DOCTYPE and bounds streamed input to 2 MB.
  Upstream advisory: https://github.com/NaturalIntelligence/fast-xml-parser/security/advisories/GHSA-8gc5-j5rx-235r

## Deployment Requirements

The app backend is `isnhgyycowmnlxtmbmwm`, not the separate finance backend
`qfcuyrdxaambvppduslo`. Apply only
`supabase/migrations/20261020180000_private_learning_history.sql` to the app
backend and deploy `good-news` with `_shared/news-feed.ts` there. Preserve all
existing finance functions, worker revisions, auth settings, secrets and IAM.
Then apply `20261021120000_learning_history_explicit_grants.sql` to revoke
inherited default table grants before restoring only SELECT/INSERT/UPDATE.
The frontend can retain local history if the table is temporarily unavailable,
but that fallback is not evidence that cloud synchronization works.

The history table has owner-only SELECT/INSERT/UPDATE policies, no anonymous
access and no client DELETE grant. Existing production user records were not
created, edited or deleted for UI tests. The guest fixture uses fictional local
records at an isolated localhost origin.

## Verification

- 146 Node tests passed; app TypeScript and production build passed.
- Targeted lint of the new modules and learning/news components passed.
- Learning rendered in Hebrew, English, Spanish, Chinese, Arabic and Russian.
  History search/review and a 390px RTL layout were checked in the browser.
- Root production-only dependency audit returned zero findings. The complete
  development/build audit returned 13 findings (8 moderate, 5 high). No forced
  breaking Tailwind/toolchain upgrade was applied. This is not a penetration test.
- The app email UI confirmed sending a generic test to the owner's mailbox.
  A focused mailbox search did not find it; delivery is not confirmed.

## Still Requires Separate Completion

- Amex direct synchronization remains blocked at the institution. CSV/Excel is
  the temporary path; the owner's newest upload still needs a real-data check.
- Isracard real login and unattended recurring bank/card synchronization are not
  proven by the successful MAX account sync.
- Full calendar invitations/attendee workflow, legacy-screen localization,
  FocusTown-level voice/multiplayer polish, native always-on blocking, project
  and course sharing/print E2E, shopping polish and full security review remain.
- Backend deployment and public frontend publication must be recorded from
  actual deployment results, not inferred from the local checks above.
