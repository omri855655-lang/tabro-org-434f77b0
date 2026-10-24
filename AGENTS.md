# Agent rules

- Edge functions must not import from `src/`; keep a copy inside the function's folder (or `supabase/functions/_shared/`) with a test asserting it matches the app copy, because only `supabase/functions/` is bundled on deploy.
- Focus room 3D scenes light themselves with a locally generated `RoomEnvironment` bounce map (replaced by the bundled reading-room HDR when room assets load); never use remote HDR/CDN presets, because a failed fetch leaves the room blank and ceilings unlit.
