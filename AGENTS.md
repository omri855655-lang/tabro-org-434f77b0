# Agent rules

- Edge functions must not import from `src/`; keep a copy inside the function's folder (or `supabase/functions/_shared/`) with a test asserting it matches the app copy, because only `supabase/functions/` is bundled on deploy.
