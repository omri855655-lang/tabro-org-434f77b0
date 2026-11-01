# Agent rules

- Edge functions must not import from `src/`; keep a copy inside the function's folder (or `supabase/functions/_shared/`) with a test asserting it matches the app copy, because only `supabase/functions/` is bundled on deploy.
- Focus room 3D scenes light themselves with a locally generated `RoomEnvironment` bounce map (replaced by the bundled reading-room HDR when room assets load); never use remote HDR/CDN presets, because a failed fetch leaves the room blank and ceilings unlit.
- Shared pure logic used by both the app and edge functions lives in `supabase/functions/_shared/` and `src/lib/*` re-exports it (e.g. `dailyBriefing.ts`), so the app preview and scheduled emails cannot drift apart.
- Scheduled (cron) edge functions authenticate with an `x-scheduler-token` checked by `verify_scheduler_token` against `private.scheduler_tokens`; cron commands read the token from that table, so no key is stored in cron job text, the repo or the frontend.
- Scheduled personal emails claim a per-user/date/slot row atomically (`claim_daily_briefing`) and send with a stable provider idempotency key; only mark success after the provider returns a message id, because retries and overlapping ticks must never duplicate mail.
- Resend senders use `Tabro <noreply@tabro.org>`; Lovable Emails functions (`auth-email-hook`, `send-transactional-email`) keep `SENDER_DOMAIN = "notify.tabro.org"`, because that delegated subdomain is the only domain the Lovable email API recognises.
