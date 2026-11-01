# Mail and terminal follow-up - 2026-11-01

## Applied and verified

- The managed app database lacked `email_analyses.external_message_id`, even though the deployed Gmail sync writes it. Added the nullable column and a full unique index on `(connection_id, external_message_id)` without deleting or rewriting legacy rows. The full index supports PostgREST upsert inference; NULL legacy identities remain allowed.
- Actual user-initiated read-only Gmail sync then persisted current November messages. Verified provider identity counts equal distinct provider identity counts. The app no longer remains limited to September data.
- Source migration: `drizzle/migrations/0018_email_sync_message_identity.sql` (generated with drizzle-kit). Live schema applied through the managed database connector; schema cache reloaded.
- Client message identity now prefers Gmail IDs and suppresses matching legacy display copies without merging distinct messages with identical metadata or deleting rows.
- AI email review now uses `customPrompt`, the field accepted by the existing backend. Added an explicitly consented, on-demand briefing coach using the existing provider; no automatic extra AI calls, body/attachment uploads, or task writes. No paid inference was invoked during QA.
- Airport scenery uses a new aircraft model: two swept main wings, separate tailplanes/fin, two engines, cockpit, passenger windows, winglets, navigation markers and six wheels. Gate door coordinates, scenery animation, resource ownership, avatars and seating are preserved. Tyres meet the apron plane.

## Source prepared, not independently deployed to the managed edge runtime

- `email-sync` now checks actual persistence errors, does not count failed writes as success, rejects unsupported providers, uses Gmail internal receive dates, and withholds successful checkpoints after partial failure.
- Main managed Edge Function deployment requires an additional authorized Lovable run or an authorized direct deployment connection. Do not claim these source-only guards are deployed solely because the frontend was published.

## Pending user-dependent checks

- Requested iPhone Home Screen local-notification display test. This is not proof of server push delivery.
- Requested admin PIN/login in the `/creator-admin` tab; no password or code was read, guessed or requested in chat.
- Requested explicit approval for another paid, tightly scoped server deployment for important-mail background notifications and a user-scoped server push test. Do not reuse the previous one-time paid-run approval.
- First scheduled afternoon briefing is due at 16:00 Asia/Jerusalem. A proposed temporary monitoring heartbeat was rejected because persistent Gmail/database access needs explicit approval. A specific user approval request is pending; no monitoring automation was created.

## Amex

- No new credential attempt or WAF bypass was performed. Existing evidence is HTTP 403 at the issuer login document, before an observed password request. Manual issuer login works.
- Rechecked upstream Amex implementation and the supplied MCP wrapper. The wrapper depends on the same scraper family; replacing the wrapper is not evidence of a working connection. Keep Excel fallback and other providers intact.
- Sources: https://raw.githubusercontent.com/eshaham/israeli-bank-scrapers/master/src/scrapers/amex.ts and https://raw.githubusercontent.com/mottibec/israeli-bank-mcp/main/package.json

## Verification

- App tests: 312 passing before the final aircraft grounding refinement; aircraft/scenery tests also passed after that refinement.
- App typecheck and production build passed. New pure helper/model files lint clean.
- Local aircraft screenshot: `/tmp/tabro-airport-aircraft-upgrade.png` (QA view, not a claim of photorealistic full-room quality).
