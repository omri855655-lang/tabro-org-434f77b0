# Independent deployment and migration

## Verified account inventory

Repository: `omri855655-lang/tabro-org-434f77b0`. Keep this repository and GitHub access.

Source in the app's local build environment: `isnhgyycowmnlxtmbmwm` (Lovable Cloud).
Read-only source inventory: 5 auth users, 1,117 tasks, 4 projects, 5 profiles, 3 storage objects.
Owner-controlled target: `qfcuyrdxaambvppduslo` (Tabro, active, eu-central-1).
Read-only target inventory: 0 auth users, 0 tasks, 0 projects, 0 profiles, 0 storage objects. Its public schema and many older Edge Functions already exist. Do not treat the existing empty schema as a completed migration.
The other owner project `slptgamuhzxiacmbpgkq` is inactive.

## Prepared code

- AI task helper, agent and Gmail classification call Google's Gemini compatibility endpoint directly using `GEMINI_API_KEY`. Model names, images, tools, JSON output and streaming are retained. Optional `GEMINI_FLASH_MODEL`/`GEMINI_PRO_MODEL` overrides select available models. `AI_ENABLED=false` stops these calls, and `AI_MAX_OUTPUT_TOKENS` bounds each answer. This is not a total monetary spending cap.
- Welcome, invitation, task, contact, admin and push-related email sends use Resend directly. The queue worker also sends through Resend with an idempotency key. Queue-level unsubscribe headers and provider webhook handling require end-to-end review before enabling delivery.
- The legacy browser auth wrapper uses Supabase OAuth directly; OAuth provider credentials and allowed redirects must be configured on the target. The Lovable auth SDK and development tagger were removed.
- `wrangler.jsonc` serves the Vite SPA on Cloudflare Workers. It creates only a workers.dev preview, without modifying the custom domain.
- The manual GitHub Actions workflow `.github/workflows/independent-preview.yml` checks public target configuration, tests and builds before deployment. The shell Git credential rejected workflow changes, but the connected GitHub account successfully installed the workflow on the migration branch. `deployment/independent-preview.workflow.yml` remains a portable copy. No new external infrastructure has been provisioned by merely adding this workflow.

## Required account configuration

Create the GitHub environment `independent-preview` in the existing repository:

Variables: `TABRO_SUPABASE_URL`, `TABRO_SUPABASE_PROJECT_ID`, `CLOUDFLARE_ACCOUNT_ID`.
Secrets: `TABRO_SUPABASE_PUBLISHABLE_KEY`, `CLOUDFLARE_API_TOKEN` scoped to deploying the Worker.
Use the confirmed owner target, not the Cloud source. The configuration check refuses the confirmed Cloud source URL.

Target Supabase server secrets: `GEMINI_API_KEY`, `RESEND_API_KEY_1` plus the service-specific finance worker, encryption, Gmail, push, webhook and Telegram secrets read by the existing functions. Do not put these values in Git or in `VITE_` variables. Transfer encryption keys unchanged where existing encrypted financial credentials depend on them.

## Data cutover work still required

1. Obtain a restorable source database backup through the supported Cloud export workflow or a secure direct database connection. Schema migration files do not contain records, auth users or uploaded file contents.
2. Compare the complete source schema, policies, triggers, cron jobs, extensions and functions with the target. Test restore in a separate database before touching the owner target's existing finance service. A table-only JSON copy is insufficient.
3. Migrate auth users/identities preserving IDs, references and password hashes using supported database tooling. Configure OAuth credentials, SMTP and redirect URLs; verify sign-in and account recovery. Existing browser sessions can require signing in again.
4. Copy every bucket's files, metadata and policies; compare counts and file hashes. Read-only inventory counted 3 source objects.
5. Deploy matching Edge Functions to the target with its secrets and verify tenant isolation, Realtime, public task intake, mail, finance worker, push, Telegram, AI image and tool workflows.
6. Configure authentication mail directly with Supabase/Resend. Existing `auth-email-hook`, suppression and preview handlers still use Lovable-specific webhook formats and keys. Replace or retire those handlers and their cron/hooks before declaring independence. They are deliberately not silently disabled on the live app.
7. Test the Cloudflare preview with migrated data. Use a short write freeze and final delta transfer, then switch the domain/DNS with a documented rollback. Do not cancel or delete the old service before this passes.

## Current status

An independent frontend preview is deployed at `https://tabro-independent.omri855655.workers.dev` in the owner's confirmed Cloudflare account. Version: `0c76f3a7-e4ba-4039-a38c-96fa4f847495`. Its build uses the owner target `qfcuyrdxaambvppduslo`, not the Cloud source. Browser configuration is held in ignored `.env.independent.local`. Admin mail now follows the configured project unless explicitly overridden.

No data, passwords, stored files, custom domains, subscriptions or production functions have been moved or changed by this branch. No Lovable agent was invoked for this migration work. Google/Resend calls were tested with mocks, not paid live requests. Target server secrets, source backup access and complete schema/data migration remain necessary to finish the move. The Cloudflare local OAuth connection is confirmed; the GitHub Actions environment still needs separate account-side CI credentials/configuration.

Read-only relation/column comparison is saved in `independent-schema-audit.json`: the target lacks five source relations and seven columns. It has additional older relations as well, so running an unchecked restore over the target is not a valid migration procedure.

References: https://docs.lovable.dev/tips-tricks/external-deployment-hosting ; https://ai.google.dev/gemini-api/docs/openai ; https://developers.cloudflare.com/workers/static-assets/
