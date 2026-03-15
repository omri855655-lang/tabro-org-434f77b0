
-- Activity log for sharing events
CREATE TABLE public.sharing_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  target_email text,
  target_display_name text,
  sheet_name text,
  task_type text,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sharing_activity_log ENABLE ROW LEVEL SECURITY;

-- Owner can see their own activity
CREATE POLICY "Users can view own sharing activity"
  ON public.sharing_activity_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sharing activity"
  ON public.sharing_activity_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Also let collaborators see activity about sheets shared with them
CREATE POLICY "Collaborators can view sharing activity"
  ON public.sharing_activity_log FOR SELECT
  USING (
    lower(target_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
  );
