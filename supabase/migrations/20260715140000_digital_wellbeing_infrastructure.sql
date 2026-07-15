CREATE TABLE IF NOT EXISTS public.wellbeing_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('computer', 'iphone', 'android')),
  name text NOT NULL,
  external_device_id text,
  connected boolean NOT NULL DEFAULT false,
  screen_minutes_today integer NOT NULL DEFAULT 0 CHECK (screen_minutes_today >= 0),
  permission_status text NOT NULL DEFAULT 'unavailable' CHECK (permission_status IN ('granted', 'denied', 'needs-install', 'unavailable')),
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, external_device_id)
);

CREATE TABLE IF NOT EXISTS public.wellbeing_blocked_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('app', 'website')),
  identifier text NOT NULL,
  display_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  minutes_saved numeric(12, 2) NOT NULL DEFAULT 0 CHECK (minutes_saved >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_type, identifier)
);

CREATE TABLE IF NOT EXISTS public.wellbeing_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.wellbeing_devices(id) ON DELETE SET NULL,
  mode text NOT NULL DEFAULT 'focus' CHECK (mode IN ('focus', 'strict', 'scheduled', 'room')),
  started_at timestamptz NOT NULL DEFAULT now(),
  planned_end_at timestamptz,
  ended_at timestamptz,
  duration_minutes integer NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'cancelled')),
  policy_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wellbeing_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  days_of_week smallint[] NOT NULL DEFAULT '{}',
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Jerusalem',
  enabled boolean NOT NULL DEFAULT true,
  policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wellbeing_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellbeing_blocked_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellbeing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellbeing_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their wellbeing devices" ON public.wellbeing_devices FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users manage their blocked items" ON public.wellbeing_blocked_items FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users manage their wellbeing sessions" ON public.wellbeing_sessions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users manage their wellbeing schedules" ON public.wellbeing_schedules FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS wellbeing_sessions_user_started_idx ON public.wellbeing_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS wellbeing_blocked_items_user_enabled_idx ON public.wellbeing_blocked_items (user_id, enabled);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellbeing_devices, public.wellbeing_blocked_items, public.wellbeing_sessions, public.wellbeing_schedules TO authenticated;
