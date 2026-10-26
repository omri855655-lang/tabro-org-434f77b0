# Workspace usability follow-up, 2026-10-26

## Approved scope

- Compact project summaries and a collapsed new-project form, retaining team setup.
- Start the planner near the current hour. New toolbar activities/presets and the
  N shortcut use the current local date/minute; clicked slots keep their selected time.
- After saving a new unlinked activity not matching loaded task titles, offer one
  task in personal/work tasks, an owned custom board, or an owned project.
- Improve ZoneFlow dashboard text contrast and put background choices in a closed
  appearance disclosure. No room, avatar, music engine, or timer changes.
- Stop task-table refreshes interrupting editing; upload code for user publication
  through Lovable, without running the paid Lovable agent.

## Implementation and safeguards

- Realtime task reads are background updates, not loading-screen transitions.
  Request sequence guards discard out-of-order responses.
- Inline editors are module-level components with stable row/field keys; their
  draft remains local during parent updates. Enter/Escape/suggestion selection
  cannot also submit an old value through the subsequent blur.
- Task creation is opt-in. Dismissal leaves the calendar event intact. Destination
  locks on the first attempt; the event UUID is also the task UUID for safe retry
  after an ambiguous response. Existing rows are not overwritten. Linking checks
  the event owner, and only fills a missing source. Each recurring series offers
  one task for the first occurrence, not one for every occurrence.
- No schema, authentication, credential, provider, or financial-record changes.

## Verification and limits

- TypeScript and production Vite build passed.
- 21 targeted tests passed: defaults, task insertion/retry permission failures,
  initial/background loading, response ordering, editor identity, calendar range,
  and project scheduling. Source-structure checks are not browser interaction tests.
- New helper/component ESLint checks passed. Existing large components still have
  pre-existing lint errors; this is not a whole-repository lint cleanup.
- Local UI verification is still unavailable due to the browser access limitation.
  No production tasks were added or edited for testing.
- Shared projects not owned by the current user are deliberately not offered as
  destinations until their write permissions are resolved explicitly.
- Independent-hosting/provider migration remains paused. Publish only product
  feature commits onto the Lovable-connected branch, not the migration commits.

## Lovable release preparation

- Verified in the project's Git settings that the connected repository is
  omri855655-lang/tabro-org-434f77b0, branch main.
- Cherry-picked nutrition, daily health import, course companion, reviewed Amex
  corrections, and this usability change onto the current main base.
- Confirmed the release does not change the Supabase client, Lovable login
  integration, environment file, dependency lockfile, or Vite configuration.
- The exact release passed all 258 product tests, TypeScript, and Vite build.
  Four migration-only tests remain on the independent-hosting branch.
- Existing lint totals were compared before/after on each touched legacy file:
  no new errors or warnings. Large-bundle build warnings remain.
- Publication is left to the user in Lovable. Git synchronization is not proof
  of a production deployment or of the task-ai-helper function being redeployed.
